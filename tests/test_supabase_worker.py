"""Unit tests for scripts/supabase_worker.py (no network, no LLM).

A small in-memory PostgREST fake stands in for Supabase (it mirrors the filters,
upserts and the trading_runs status-transition trigger the worker relies on),
and a fake graph runner replays TradingAgents-shaped state chunks.
"""

from __future__ import annotations

import ast
import importlib.util
import json
import re
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
WORKER_PATH = ROOT / "scripts" / "supabase_worker.py"


def _load_worker():
    name = "am_supabase_worker_under_test"
    if name in sys.modules:
        return sys.modules[name]
    spec = importlib.util.spec_from_file_location(name, WORKER_PATH)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module  # dataclasses resolve the module by name
    spec.loader.exec_module(module)
    return module


sw = _load_worker()

SERVICE_KEY = "test-service-role-key-0123456789abcdef"
NOW = datetime(2026, 9, 25, 12, 0, tzinfo=timezone.utc)
HOST = "pc-owner"


# ---------------------------------------------------------------------------
# Fake PostgREST
# ---------------------------------------------------------------------------


class FakeResponse:
    def __init__(self, status: int, body=None):
        self.status_code = status
        self._body = body
        self.content = b"" if body is None else json.dumps(body).encode()
        self.text = self.content.decode()

    def json(self):
        if self._body is None:
            raise ValueError("no body")
        return self._body


_TRANSITIONS = {
    "QUEUED": {"RUNNING", "CANCELLED", "FAILED"},
    "RUNNING": {"COMPLETED", "FAILED", "CANCELLED", "QUEUED"},
    "FAILED": {"QUEUED"},
}
_IMMUTABLE = ("id", "tenant_id", "symbol", "trade_date", "mode", "analysts", "correlation_id")
_CONTROL_PARAMS = {"select", "order", "limit", "on_conflict"}


def _as_dt(value):
    return datetime.fromisoformat(str(value).replace("Z", "+00:00"))


def _matches(row: dict, col: str, expr: str) -> bool:
    op, _, val = expr.partition(".")
    cur = row.get(col)
    if op == "eq":
        return cur is not None and str(cur) == val
    if op == "lt":
        return cur is not None and _as_dt(cur) < _as_dt(val)
    if op == "like":
        pattern = "^" + re.escape(val).replace(r"\*", ".*") + "$"
        return cur is not None and re.match(pattern, str(cur)) is not None
    if op == "in":
        return cur is not None and str(cur) in val.strip("()").split(",")
    raise AssertionError(f"unsupported filter {col}={expr}")


class FakePostgrest:
    """Just enough PostgREST for the worker; records every request."""

    def __init__(self, rpc_claim: bool = False):
        self.tables: dict[str, list[dict]] = {
            t: [] for t in ("trading_runs", "run_events", "agent_reports", "decision_traces",
                            "tenant_settings")
        }
        self.rpc_claim = rpc_claim
        self.requests: list[dict] = []
        self.hooks: list = []
        self._event_id = 0

    # -- helpers for tests --------------------------------------------------
    def run(self, run_id):
        return next(r for r in self.tables["trading_runs"] if r["id"] == run_id)

    def events(self, run_id=None):
        return [e for e in self.tables["run_events"] if run_id is None or e["run_id"] == run_id]

    def add_run(self, **overrides) -> dict:
        tenant = overrides.pop("tenant_id", None) or str(uuid.uuid4())
        created = overrides.pop("created_at", None) or (
            NOW - timedelta(minutes=10 - len(self.tables["trading_runs"]))).isoformat()
        row = {
            "id": str(uuid.uuid4()), "tenant_id": tenant, "created_by": None,
            "symbol": "NVDA", "trade_date": "2026-09-24", "mode": "PAPER", "status": "QUEUED",
            "analysts": ["market", "social", "news", "fundamentals"],
            "correlation_id": str(uuid.uuid4()), "final_rating": None, "final_decision": None,
            "error": None, "worker_id": None, "started_at": None, "finished_at": None,
            "heartbeat_at": None, "created_at": created, "updated_at": created,
        }
        row.update(overrides)
        self.tables["trading_runs"].append(row)
        if not any(s["tenant_id"] == tenant for s in self.tables["tenant_settings"]):
            self.tables["tenant_settings"].append(
                {"tenant_id": tenant, "kill_switch_active": False, "trading_mode": "PAPER"})
        return row

    def set_kill_switch(self, tenant_id, active=True):
        for s in self.tables["tenant_settings"]:
            if s["tenant_id"] == tenant_id:
                s["kill_switch_active"] = active

    # -- transport ------------------------------------------------------------
    def request(self, method, url, params=None, json=None, headers=None, timeout=None,
                allow_redirects=True):
        assert url.startswith("https://example.supabase.co/rest/v1/"), url
        path = url.split("/rest/v1/", 1)[1]
        params = dict(params or {})
        headers = dict(headers or {})
        entry = {"method": method, "path": path, "params": params, "json": json,
                 "headers": headers, "timeout": timeout, "allow_redirects": allow_redirects}
        self.requests.append(entry)
        for hook in list(self.hooks):
            hook(self, entry)
        if path.startswith("rpc/"):
            return self._rpc(path[4:], json or {})
        rows = self.tables[path]
        filters = {k: v for k, v in params.items() if k not in _CONTROL_PARAMS}
        matched = [r for r in rows if all(_matches(r, c, e) for c, e in filters.items())]
        if method == "GET":
            if "order" in params:
                col, _, direction = params["order"].partition(".")
                matched.sort(key=lambda r: r[col], reverse=direction == "desc")
            if "limit" in params:
                matched = matched[: int(params["limit"])]
            return FakeResponse(200, [dict(r) for r in matched])
        if method == "PATCH":
            return self._patch(path, matched, json, headers)
        if method == "POST":
            return self._post(path, json, params, headers)
        raise AssertionError(f"unexpected {method} {path}")

    def _patch(self, table, matched, values, headers):
        for row in matched:
            if table == "trading_runs":
                if any(k in values and values[k] != row[k] for k in _IMMUTABLE):
                    return FakeResponse(403, {"code": "42501", "message": "inmutable"})
                new_status = values.get("status", row["status"])
                if new_status != row["status"] and new_status not in _TRANSITIONS.get(row["status"], set()):
                    return FakeResponse(400, {"code": "22023",
                                              "message": f"Transición de estado inválida: {row['status']} -> {new_status}"})
        for row in matched:
            row.update(values)
            row["updated_at"] = NOW.isoformat()
        if "return=representation" in headers.get("Prefer", ""):
            return FakeResponse(200, [dict(r) for r in matched])
        return FakeResponse(204)

    def _post(self, table, body, params, headers):
        rows = body if isinstance(body, list) else [body]
        prefer = headers.get("Prefer", "")
        conflict = params.get("on_conflict")
        for row in rows:
            row = dict(row)
            if table == "run_events":
                run = self.run(row["run_id"])
                assert row["tenant_id"] == run["tenant_id"], "tenant mismatch"
                self._event_id += 1
                row["id"] = self._event_id
                row["created_at"] = NOW.isoformat()
            existing = None
            if conflict:
                keys = conflict.split(",")
                existing = next((r for r in self.tables[table]
                                 if all(r.get(k) == row.get(k) for k in keys)), None)
            elif table == "decision_traces":
                existing = next((r for r in self.tables[table] if r["run_id"] == row["run_id"]), None)
                if existing:
                    return FakeResponse(409, {"code": "23505", "message": "duplicate key"})
            if existing is not None:
                if "resolution=merge-duplicates" in prefer:
                    existing.update(row)
                elif "resolution=ignore-duplicates" not in prefer:
                    return FakeResponse(409, {"code": "23505", "message": "duplicate key"})
                continue
            self.tables[table].append(row)
        return FakeResponse(201)

    def _rpc(self, name, args):
        if name != "worker_claim_trading_run" or not self.rpc_claim:
            return FakeResponse(404, {"code": "PGRST202", "message": f"Could not find the function public.{name}"})
        blocked = {s["tenant_id"] for s in self.tables["tenant_settings"] if s["kill_switch_active"]}
        queued = sorted((r for r in self.tables["trading_runs"]
                         if r["status"] == "QUEUED" and r["tenant_id"] not in blocked),
                        key=lambda r: r["created_at"])
        if not queued:
            return FakeResponse(200, [])
        run = queued[0]
        run.update(status="RUNNING", worker_id=args["p_worker_id"], started_at=NOW.isoformat(),
                   heartbeat_at=NOW.isoformat(), error=None)
        return FakeResponse(200, [dict(run)])


# ---------------------------------------------------------------------------
# Fake graph
# ---------------------------------------------------------------------------

PM_DECISION = "**Rating**: Overweight\n\n**Executive Summary**: acumular de forma gradual."


def full_run_chunks(analysts=("market", "social", "news", "fundamentals")):
    """State snapshots as LangGraph's stream_mode='values' yields them."""
    state: dict = {
        "messages": [("ai", "<think>razonamiento privado del modelo</think> tool call")],
        "company_of_interest": "NVDA",
        "trade_date": "2026-09-24",
        "investment_debate_state": {"bull_history": "", "bear_history": "", "history": "",
                                    "current_response": "", "judge_decision": "", "count": 0},
        "risk_debate_state": {"aggressive_history": "", "conservative_history": "",
                              "neutral_history": "", "history": "", "latest_speaker": "",
                              "judge_decision": "", "count": 0},
        "market_report": "", "sentiment_report": "", "news_report": "", "fundamentals_report": "",
    }
    chunks = [json.loads(json.dumps(state))]

    def snap(**changes):
        for key, value in changes.items():
            if isinstance(value, dict):
                state[key] = {**state[key], **value}
            else:
                state[key] = value
        chunks.append(json.loads(json.dumps(state)))

    reports = {
        "market": ("market_report", "<think>no guardar esto</think>Informe de mercado: tendencia alcista."),
        "social": ("sentiment_report", "Informe de sentimiento positivo."),
        "news": ("news_report", "Informe de noticias neutral."),
        "fundamentals": ("fundamentals_report", "Informe fundamental sólido."),
    }
    for analyst in analysts:
        key, text = reports[analyst]
        snap(**{key: text})
    snap(investment_debate_state={"bull_history": "\nBull Analyst: caso alcista", "count": 1})
    snap(investment_debate_state={"bear_history": "\nBear Analyst: caso bajista", "count": 2})
    snap(investment_debate_state={"judge_decision": "Plan de inversión: Buy moderado"},
         investment_plan="Plan de inversión: Buy moderado")
    snap(trader_investment_plan="Propuesta del trader: comprar escalonado")
    snap(risk_debate_state={"aggressive_history": "\nAggressive Analyst: más tamaño", "count": 1})
    snap(risk_debate_state={"conservative_history": "\nConservative Analyst: stop ajustado", "count": 2})
    snap(risk_debate_state={"neutral_history": "\nNeutral Analyst: equilibrio", "count": 3})
    snap(risk_debate_state={"judge_decision": PM_DECISION}, final_trade_decision=PM_DECISION)
    return chunks


class FakeSession:
    def __init__(self, chunks, fail_at=None, error="boom", on_chunk=None, on_end=None):
        self.chunks = chunks
        self.fail_at = fail_at
        self.error = error
        self.on_chunk = on_chunk
        self.on_end = on_end
        self.yielded = 0
        self.finalized = None
        self.closed = False
        self.generator_closed = False

    def stream(self):
        try:
            for index, chunk in enumerate(self.chunks):
                if self.fail_at is not None and index == self.fail_at:
                    raise RuntimeError(self.error)
                self.yielded += 1
                yield chunk
                if self.on_chunk:
                    self.on_chunk(index)
            if self.on_end:
                self.on_end()
        except GeneratorExit:
            self.generator_closed = True
            raise

    def finalize(self, final_state):
        self.finalized = dict(final_state)

    def close(self):
        self.closed = True


class FakeRunner:
    def __init__(self, session_factory=None):
        self.session_factory = session_factory or (lambda job: FakeSession(full_run_chunks(job.analysts)))
        self.jobs = []
        self.sessions = []

    def open(self, job):
        self.jobs.append(job)
        session = self.session_factory(job)
        self.sessions.append(session)
        return session

    def model_versions(self):
        return {"provider": "openai", "effective_provider": "openai_compatible",
                "deep_model": "qwen3.8-27b", "quick_model": "qwen3.8-27b",
                "backend_url": "http://127.0.0.1:8080/v1"}


def make_worker(db, runner=None, tenant_ids=(), **kwargs):
    settings = sw.WorkerSettings(supabase_url="https://example.supabase.co",
                                 service_role_key=SERVICE_KEY, tenant_ids=tuple(tenant_ids))
    rest = sw.SupabaseRest(settings.supabase_url, settings.service_role_key, session=db)
    kwargs.setdefault("heartbeat_seconds", 0)
    kwargs.setdefault("heartbeat_thread", False)
    return sw.SupabaseWorker(rest, settings, runner or FakeRunner(), hostname=HOST,
                             worker_id=f"{HOST}-4242", sleep=lambda s: None,
                             now=lambda: NOW, **kwargs)


def event_types(db, run_id):
    return [e["event_type"] for e in db.events(run_id)]


# ---------------------------------------------------------------------------
# Claiming
# ---------------------------------------------------------------------------


def test_claim_race_zero_rows_skips_run():
    db = FakePostgrest()
    run = db.add_run()

    def someone_else_claims(fake, req):
        if req["method"] == "PATCH" and req["params"].get("status") == "eq.QUEUED":
            fake.run(run["id"]).update(status="RUNNING", worker_id="otro-host-1")

    db.hooks.append(someone_else_claims)
    runner = FakeRunner()
    worker = make_worker(db, runner)

    assert worker.run_once() is False
    assert runner.jobs == []
    assert db.events() == []
    assert db.run(run["id"])["worker_id"] == "otro-host-1"


def test_patch_claim_is_conditional_and_sets_owner_fields():
    db = FakePostgrest()
    run = db.add_run()
    worker = make_worker(db)

    claimed = worker.claim_next_run()

    assert claimed["id"] == run["id"]
    patch = next(r for r in db.requests if r["method"] == "PATCH")
    assert patch["params"] == {"id": f"eq.{run['id']}", "status": "eq.QUEUED"}
    assert "return=representation" in patch["headers"]["Prefer"]
    row = db.run(run["id"])
    assert row["status"] == "RUNNING"
    assert row["worker_id"] == f"{HOST}-4242"
    assert row["started_at"] and row["heartbeat_at"]


def test_claim_picks_oldest_and_skips_kill_switch_tenants():
    db = FakePostgrest()
    blocked = db.add_run(created_at=(NOW - timedelta(hours=2)).isoformat())
    newer = db.add_run(created_at=(NOW - timedelta(hours=1)).isoformat())
    oldest_ok = db.add_run(created_at=(NOW - timedelta(hours=1, minutes=30)).isoformat())
    db.set_kill_switch(blocked["tenant_id"])

    claimed = make_worker(db).claim_next_run()

    assert claimed["id"] == oldest_ok["id"]
    assert db.run(blocked["id"])["status"] == "QUEUED"
    assert db.run(newer["id"])["status"] == "QUEUED"


def test_rpc_claim_preferred_when_available():
    db = FakePostgrest(rpc_claim=True)
    run = db.add_run()
    worker = make_worker(db)

    claimed = worker.claim_next_run()

    assert claimed["id"] == run["id"]
    assert [r["path"] for r in db.requests] == ["rpc/worker_claim_trading_run"]
    assert db.requests[0]["json"] == {"p_worker_id": f"{HOST}-4242"}


def test_tenant_allowlist_only_claims_allowed_workspaces():
    db = FakePostgrest(rpc_claim=True)
    stranger = db.add_run(created_at=(NOW - timedelta(hours=2)).isoformat())
    owner_tenant = str(uuid.uuid4())
    mine = db.add_run(tenant_id=owner_tenant, created_at=(NOW - timedelta(hours=1)).isoformat())
    worker = make_worker(db, tenant_ids=[owner_tenant])

    assert worker.claim_next_run()["id"] == mine["id"]
    assert worker.claim_next_run() is None
    assert db.run(stranger["id"])["status"] == "QUEUED"
    # Con lista de workspaces no se usa la RPC (que reclama de cualquier tenant).
    assert not any(r["path"].startswith("rpc/") for r in db.requests)
    select = next(r for r in db.requests if r["method"] == "GET" and r["path"] == "trading_runs")
    assert select["params"]["tenant_id"] == f"in.({owner_tenant})"


def test_requests_never_follow_redirects_and_3xx_is_an_error():
    db = FakePostgrest()
    worker = make_worker(db)
    worker.claim_next_run()
    assert db.requests and all(r["allow_redirects"] is False for r in db.requests)

    class Redirecting:
        def request(self, *args, **kwargs):
            return FakeResponse(301)

    rest = sw.SupabaseRest("https://example.supabase.co", SERVICE_KEY, session=Redirecting())
    with pytest.raises(sw.SupabaseError, match="redirección") as info:
        rest.select("trading_runs", {"select": "id"})
    assert SERVICE_KEY not in str(info.value)


def test_missing_rpc_falls_back_to_patch_and_is_not_retried():
    db = FakePostgrest(rpc_claim=False)
    first = db.add_run()
    second = db.add_run()
    worker = make_worker(db)

    assert worker.claim_next_run()["id"] == first["id"]
    assert worker.claim_next_run()["id"] == second["id"]
    rpc_calls = [r for r in db.requests if r["path"].startswith("rpc/")]
    assert len(rpc_calls) == 1


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------


def test_happy_path_writes_reports_events_trace_and_completes():
    db = FakePostgrest()
    run = db.add_run()
    runner = FakeRunner()
    worker = make_worker(db, runner)

    assert worker.run_once() is True

    row = db.run(run["id"])
    assert row["status"] == "COMPLETED"
    assert row["final_rating"] == "OVERWEIGHT"
    assert row["final_decision"] == PM_DECISION
    assert row["finished_at"] and row["error"] is None

    # The graph got exactly what the run asked for.
    job = runner.jobs[0]
    assert job.symbol == "NVDA" and job.trade_date == "2026-09-24"
    assert job.analysts == ("market", "social", "news", "fundamentals")
    assert job.asset_type == "stock"
    session = runner.sessions[0]
    assert session.closed and session.finalized is not None

    # Upstream state keys map onto the contract's agent keys.
    reports = {r["agent"]: r for r in db.tables["agent_reports"]}
    assert set(reports) == set(sw.AGENT_LABELS)
    assert reports["market"]["content"] == "Informe de mercado: tendencia alcista."
    assert reports["social"]["content"] == "Informe de sentimiento positivo."
    assert reports["news"]["content"] == "Informe de noticias neutral."
    assert reports["fundamentals"]["content"] == "Informe fundamental sólido."
    assert reports["bull"]["content"] == "Bull Analyst: caso alcista"
    assert reports["bear"]["content"] == "Bear Analyst: caso bajista"
    assert reports["research_manager"]["content"] == "Plan de inversión: Buy moderado"
    assert reports["trader"]["content"] == "Propuesta del trader: comprar escalonado"
    assert reports["aggressive"]["content"] == "Aggressive Analyst: más tamaño"
    assert reports["conservative"]["content"] == "Conservative Analyst: stop ajustado"
    assert reports["neutral"]["content"] == "Neutral Analyst: equilibrio"
    assert reports["portfolio_manager"]["content"] == PM_DECISION
    for agent, report in reports.items():
        assert report["title"] == sw.AGENT_LABELS[agent]
        assert report["tenant_id"] == run["tenant_id"]
        assert "<think>" not in report["content"] and "razonamiento" not in report["content"]
    upserts = [r for r in db.requests if r["path"] == "agent_reports"]
    assert all(r["params"] == {"on_conflict": "run_id,agent"} for r in upserts)
    assert all("resolution=merge-duplicates" in r["headers"]["Prefer"] for r in upserts)

    # Events: started, per-agent start/publish in graph order, completed.
    events = db.events(run["id"])
    types = [e["event_type"] for e in events]
    assert types[0] == "RunStarted" and types[-1] == "RunCompleted"
    assert "RunFailed" not in types
    for event in events:
        assert event["tenant_id"] == run["tenant_id"]
        assert event["correlation_id"] == run["correlation_id"]
    published = [e["agent"] for e in events if e["event_type"] == "AgentReportPublished"]
    assert published == ["market", "social", "news", "fundamentals", "bull", "bear",
                         "research_manager", "trader", "aggressive", "conservative", "neutral",
                         "portfolio_manager"]
    for agent in published:
        idx_start = next(i for i, e in enumerate(events)
                         if e["event_type"] == "AgentStarted" and e["agent"] == agent)
        idx_pub = next(i for i, e in enumerate(events)
                       if e["event_type"] == "AgentReportPublished" and e["agent"] == agent)
        assert idx_start < idx_pub
    assert events[-1]["payload"]["final_rating"] == "OVERWEIGHT"
    assert "backend_url" not in events[0]["payload"]

    # Immutable decision trace.
    (trace,) = db.tables["decision_traces"]
    assert trace["run_id"] == run["id"] and trace["tenant_id"] == run["tenant_id"]
    assert trace["summary"]["symbol"] == "NVDA"
    assert trace["summary"]["trade_date"] == "2026-09-24"
    assert trace["summary"]["mode"] == "PAPER"
    assert trace["summary"]["final_rating"] == "OVERWEIGHT"
    assert trace["summary"]["analysts"] == ["market", "social", "news", "fundamentals"]
    assert trace["summary"]["report_agents"] == published
    assert trace["model_versions"]["deep_model"] == "qwen3.8-27b"
    assert trace["prompt_versions"]["tradingagents"]

    # Nothing persisted the raw message stream (where reasoning could live).
    dumped = json.dumps(db.tables, default=str)
    assert "razonamiento privado" not in dumped and "no guardar esto" not in dumped


def test_every_request_uses_service_role_headers_and_never_leaks_key_into_rows():
    db = FakePostgrest()
    db.add_run()
    make_worker(db).run_once()

    assert db.requests
    for req in db.requests:
        assert req["headers"]["apikey"] == SERVICE_KEY
        assert req["headers"]["Authorization"] == f"Bearer {SERVICE_KEY}"
        assert req["timeout"]
    assert SERVICE_KEY not in json.dumps(db.tables, default=str)


def test_respects_run_analysts_subset_in_graph_order():
    db = FakePostgrest()
    run = db.add_run(analysts=["news", "market"], trade_date="2026-01-15")
    runner = FakeRunner()
    make_worker(db, runner).run_once()

    assert runner.jobs[0].analysts == ("market", "news")
    assert runner.jobs[0].trade_date == "2026-01-15"
    agents = {r["agent"] for r in db.tables["agent_reports"]}
    assert "social" not in agents and "fundamentals" not in agents
    first_started = next(e for e in db.events(run["id"]) if e["event_type"] == "AgentStarted")
    assert first_started["agent"] == "market"
    assert db.run(run["id"])["status"] == "COMPLETED"


def test_crypto_drops_fundamentals_like_the_cli():
    db = FakePostgrest()
    run = db.add_run(symbol="BTC-USD", analysts=["market", "fundamentals"])
    runner = FakeRunner()
    make_worker(db, runner).run_once()

    assert runner.jobs[0].asset_type == "crypto"
    assert runner.jobs[0].analysts == ("market",)
    assert db.run(run["id"])["status"] == "COMPLETED"


# ---------------------------------------------------------------------------
# Failure paths
# ---------------------------------------------------------------------------


def test_exception_marks_failed_without_secrets_and_loop_continues():
    db = FakePostgrest()
    bad = db.add_run()
    good = db.add_run()
    error = f"LLM caído; Authorization: Bearer {SERVICE_KEY} api_key=sk-abcdefghijklmnop"
    runner = FakeRunner(lambda job: FakeSession(full_run_chunks(job.analysts), fail_at=3, error=error)
                        if job.run_id == bad["id"] else FakeSession(full_run_chunks(job.analysts)))
    worker = make_worker(db, runner)

    assert worker.run_once() is True
    row = db.run(bad["id"])
    assert row["status"] == "FAILED"
    assert "RuntimeError" in row["error"] and "LLM caído" in row["error"]
    assert SERVICE_KEY not in row["error"] and "sk-abcdefghijklmnop" not in row["error"]
    assert len(row["error"]) <= sw.MAX_ERROR_CHARS
    types = event_types(db, bad["id"])
    assert types[-1] == "RunFailed" and "RunCompleted" not in types
    assert SERVICE_KEY not in json.dumps(db.events(bad["id"]))
    assert db.tables["decision_traces"] == []
    assert runner.sessions[0].closed

    # The next queued run is still processed.
    assert worker.run_once() is True
    assert db.run(good["id"])["status"] == "COMPLETED"


def test_graph_without_final_decision_fails():
    db = FakePostgrest()
    run = db.add_run()
    runner = FakeRunner(lambda job: FakeSession(full_run_chunks(job.analysts)[:-1]))
    make_worker(db, runner).run_once()

    row = db.run(run["id"])
    assert row["status"] == "FAILED"
    assert "Portfolio Manager" in row["error"]


def test_live_mode_is_refused_before_running_the_graph():
    db = FakePostgrest()
    run = db.add_run()
    runner = FakeRunner()
    worker = make_worker(db, runner)
    claimed = worker.claim_next_run()
    claimed["mode"] = "LIVE"  # imposible por CHECK en la BD; defensa en profundidad

    assert worker.process_run(claimed) == "FAILED"
    assert runner.jobs == []
    assert "LIVE" in db.run(run["id"])["error"]


# ---------------------------------------------------------------------------
# Cancellation / kill switch
# ---------------------------------------------------------------------------


def test_cancellation_mid_stream_stops_and_does_not_overwrite():
    db = FakePostgrest()
    run = db.add_run()

    def cancel_after_third_chunk(index):
        if index == 3:
            db.run(run["id"]).update(status="CANCELLED", finished_at=NOW.isoformat())

    runner = FakeRunner(lambda job: FakeSession(full_run_chunks(job.analysts),
                                                on_chunk=cancel_after_third_chunk))
    worker = make_worker(db, runner)

    assert worker.run_once() is True
    row = db.run(run["id"])
    assert row["status"] == "CANCELLED"
    assert row["final_rating"] is None and row["final_decision"] is None
    types = event_types(db, run["id"])
    assert not {"RunCompleted", "RunFailed"} & set(types)
    assert db.tables["decision_traces"] == []
    session = runner.sessions[0]
    assert session.generator_closed and session.closed
    assert session.yielded < len(full_run_chunks())
    assert session.finalized is None


def test_cancelled_just_before_final_write_is_not_overwritten():
    db = FakePostgrest()
    run = db.add_run()

    def cancel_at_end():
        db.run(run["id"]).update(status="CANCELLED")

    runner = FakeRunner(lambda job: FakeSession(full_run_chunks(job.analysts), on_end=cancel_at_end))
    # Heartbeat checks effectively off: only the final re-check can notice.
    make_worker(db, runner, heartbeat_seconds=3600).run_once()

    row = db.run(run["id"])
    assert row["status"] == "CANCELLED"
    assert row["final_rating"] is None
    assert db.tables["decision_traces"] == []
    assert "RunCompleted" not in event_types(db, run["id"])


def test_kill_switch_mid_run_cancels_the_run():
    db = FakePostgrest()
    run = db.add_run()
    runner = FakeRunner(lambda job: FakeSession(
        full_run_chunks(job.analysts),
        on_chunk=lambda i: db.set_kill_switch(run["tenant_id"]) if i == 2 else None))
    make_worker(db, runner).run_once()

    row = db.run(run["id"])
    assert row["status"] == "CANCELLED"
    assert "Kill switch" in row["error"]
    cancelled = [e for e in db.events(run["id"]) if e["event_type"] == "RunCancelled"]
    assert cancelled and cancelled[0]["payload"]["reason"] == "kill_switch"
    assert db.tables["decision_traces"] == []


def test_heartbeat_is_owner_conditional():
    db = FakePostgrest()
    run = db.add_run()
    make_worker(db).run_once()

    beats = [r for r in db.requests if r["method"] == "PATCH" and r["json"].keys() == {"heartbeat_at"}]
    assert beats
    for beat in beats:
        assert beat["params"] == {"id": f"eq.{run['id']}", "status": "eq.RUNNING",
                                  "worker_id": f"eq.{HOST}-4242"}


# ---------------------------------------------------------------------------
# Stale-run recovery
# ---------------------------------------------------------------------------


def test_stale_runs_of_this_host_are_marked_failed_on_startup():
    db = FakePostgrest()
    old = (NOW - timedelta(hours=2)).isoformat()
    recent = (NOW - timedelta(minutes=5)).isoformat()
    stale = db.add_run(status="RUNNING", worker_id=f"{HOST}-111", heartbeat_at=old)
    fresh = db.add_run(status="RUNNING", worker_id=f"{HOST}-222", heartbeat_at=recent)
    other_host = db.add_run(status="RUNNING", worker_id="otro-pc-333", heartbeat_at=old)
    prefix_host = db.add_run(status="RUNNING", worker_id=f"{HOST}-extra-444", heartbeat_at=old)
    mine = db.add_run(status="RUNNING", worker_id=f"{HOST}-4242", heartbeat_at=old)
    worker = make_worker(db)

    assert worker.recover_stale_runs() == 1

    row = db.run(stale["id"])
    assert row["status"] == "FAILED" and row["error"] == "worker reiniciado"
    assert event_types(db, stale["id"]) == ["RunFailed"]
    for untouched in (fresh, other_host, prefix_host, mine):
        assert db.run(untouched["id"])["status"] == "RUNNING"


def test_run_forever_once_recovers_then_processes_one_run():
    db = FakePostgrest()
    stale = db.add_run(status="RUNNING", worker_id=f"{HOST}-1",
                       heartbeat_at=(NOW - timedelta(hours=1)).isoformat())
    first = db.add_run()
    second = db.add_run()
    make_worker(db).run_forever(once=True)

    assert db.run(stale["id"])["status"] == "FAILED"
    assert db.run(first["id"])["status"] == "COMPLETED"
    assert db.run(second["id"])["status"] == "QUEUED"


def test_run_forever_once_with_empty_queue_returns():
    db = FakePostgrest()
    make_worker(db).run_forever(once=True)
    assert all(r["method"] != "PATCH" for r in db.requests)


# ---------------------------------------------------------------------------
# Pure helpers
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("**Rating**: Buy\n\nEntrar ya.", "BUY"),
        ("**Rating**: Overweight", "OVERWEIGHT"),
        ("Rating: Hold", "HOLD"),
        ("Rating — **Underweight**", "UNDERWEIGHT"),
        ("rating: sell", "SELL"),
        ("We considered Buy but conclude Sell.", "REVIEW"),
        ("Sin calificación legible", "REVIEW"),
        ("", "REVIEW"),
        (None, "REVIEW"),
    ],
)
def test_parse_final_rating(text, expected):
    assert sw.parse_final_rating(text) == expected


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("<think>privado</think>Reporte", "Reporte"),
        ("razonamiento previo</think>\n\nReporte final", "Reporte final"),
        ("Reporte<think>sin cerrar", "Reporte"),
        ("<THINKING>x</THINKING> ok", "ok"),
        ("Reporte limpio", "Reporte limpio"),
        (None, ""),
    ],
)
def test_strip_reasoning(raw, expected):
    assert sw.strip_reasoning(raw) == expected


def test_extract_agent_reports_ignores_messages_and_empty_fields():
    state = {"messages": ["<think>x</think>"], "market_report": "  ", "news_report": "N",
             "investment_debate_state": {"bull_history": "B", "judge_decision": ""},
             "investment_plan": "Plan"}
    assert sw.extract_agent_reports(state) == {"news": "N", "bull": "B", "research_manager": "Plan"}


def test_sanitize_error_redacts_and_truncates():
    jwt = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.c2lnbmF0dXJlLXZhbHVl"
    message = (f"fallo {SERVICE_KEY} Bearer abc.def apikey={jwt} "
               "http://user:secret@host/v1 " + "x" * 5000)
    clean = sw.sanitize_error(RuntimeError(message), secrets=[SERVICE_KEY])
    assert SERVICE_KEY not in clean and jwt not in clean and "user:secret" not in clean
    assert "abc.def" not in clean
    assert len(clean) <= sw.MAX_ERROR_CHARS


def test_settings_from_env_defaults_and_validation():
    settings = sw.WorkerSettings.from_env({
        "SUPABASE_URL": "https://example.supabase.co/", "SUPABASE_SERVICE_ROLE_KEY": SERVICE_KEY,
    })
    assert settings.supabase_url == "https://example.supabase.co"
    assert settings.llm_provider == "openai"
    assert settings.backend_url == "http://127.0.0.1:8080/v1"
    assert settings.deep_model == settings.quick_model == "qwen3.8-27b"
    assert settings.poll_seconds == 10
    assert SERVICE_KEY not in repr(settings)

    with pytest.raises(sw.ConfigError, match="SUPABASE_SERVICE_ROLE_KEY"):
        sw.WorkerSettings.from_env({"SUPABASE_URL": "https://example.supabase.co"})
    with pytest.raises(sw.ConfigError, match="AM_WORKER_POLL_SECONDS"):
        sw.WorkerSettings.from_env({"SUPABASE_URL": "https://x.supabase.co",
                                    "SUPABASE_SERVICE_ROLE_KEY": "k", "AM_WORKER_POLL_SECONDS": "0"})
    assert settings.tenant_ids == ()


@pytest.mark.parametrize("url", [
    "http://abc.supabase.co", "http://10.0.0.5:54321", "ftp://abc.supabase.co", "abc.supabase.co",
    "https://",
])
def test_settings_reject_non_https_supabase_url(url):
    with pytest.raises(sw.ConfigError, match="https://"):
        sw.WorkerSettings.from_env({"SUPABASE_URL": url, "SUPABASE_SERVICE_ROLE_KEY": "k"})


@pytest.mark.parametrize("url", ["http://localhost:54321", "http://127.0.0.1:54321", "http://[::1]:54321"])
def test_settings_allow_plain_http_only_for_local_supabase(url):
    settings = sw.WorkerSettings.from_env({"SUPABASE_URL": url, "SUPABASE_SERVICE_ROLE_KEY": "k"})
    assert settings.supabase_url == url


def test_settings_parse_tenant_allowlist():
    a, b = str(uuid.uuid4()), str(uuid.uuid4())
    base = {"SUPABASE_URL": "https://x.supabase.co", "SUPABASE_SERVICE_ROLE_KEY": "k"}
    settings = sw.WorkerSettings.from_env({**base, "AM_WORKER_TENANT_IDS": f" {a.upper()}, {b} ,{a}"})
    assert settings.tenant_ids == (a, b)
    with pytest.raises(sw.ConfigError, match="AM_WORKER_TENANT_IDS"):
        sw.WorkerSettings.from_env({**base, "AM_WORKER_TENANT_IDS": "mi-workspace"})


def test_openai_provider_on_local_endpoint_uses_openai_compatible():
    base = {"SUPABASE_URL": "https://x.supabase.co", "SUPABASE_SERVICE_ROLE_KEY": "k"}
    local = sw.WorkerSettings.from_env(base)
    assert sw.effective_provider(local) == "openai_compatible"
    native = sw.WorkerSettings.from_env({**base, "AM_BACKEND_URL": "https://api.openai.com/v1"})
    assert sw.effective_provider(native) == "openai"
    other = sw.WorkerSettings.from_env({**base, "AM_LLM_PROVIDER": "ollama"})
    assert sw.effective_provider(other) == "ollama"


def test_runner_config_maps_env_onto_upstream_keys_without_mutating_defaults():
    from tradingagents.default_config import DEFAULT_CONFIG

    before = json.dumps(DEFAULT_CONFIG, sort_keys=True, default=str)
    settings = sw.WorkerSettings(supabase_url="https://x.supabase.co", service_role_key="k",
                                 backend_url="http://user:pw@127.0.0.1:8080/v1?x=1",
                                 deep_model="deep-m", quick_model="quick-m")
    runner = sw.TradingAgentsRunner(settings)
    config = runner.build_config()

    assert config["llm_provider"] == "openai_compatible"
    assert config["backend_url"] == "http://user:pw@127.0.0.1:8080/v1?x=1"
    assert config["deep_think_llm"] == "deep-m" and config["quick_think_llm"] == "quick-m"
    assert json.dumps(DEFAULT_CONFIG, sort_keys=True, default=str) == before
    assert runner.model_versions()["backend_url"] == "http://127.0.0.1:8080/v1"


def test_worker_never_imports_execution_broker_or_oms():
    tree = ast.parse(WORKER_PATH.read_text(encoding="utf-8"))
    imported = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imported += [a.name for a in node.names]
        elif isinstance(node, ast.ImportFrom) and node.module:
            imported.append(node.module)
    forbidden = ("tradingagents.execution", "execution", "oms", "broker", "schwab")
    for name in imported:
        assert not any(name == f or name.startswith(f + ".") or f in name.split(".")
                       for f in forbidden), name


def test_worker_script_imports_this_repos_tradingagents(tmp_path):
    """``python scripts/supabase_worker.py`` deja sys.path[0] = scripts/: el worker
    debe anteponer la raíz del repo para no cargar otra copia instalada."""
    import subprocess

    shadow = tmp_path / "shadow"
    (shadow / "tradingagents").mkdir(parents=True)
    (shadow / "tradingagents" / "__init__.py").write_text("OLD_COPY = True\n", encoding="utf-8")
    probe = (
        "import runpy, sys\n"
        # Como al ejecutar el script: scripts/ primero; y una copia antigua instalada detrás.
        f"sys.path[:1] = [{str(WORKER_PATH.parent)!r}, {str(shadow)!r}]\n"
        f"runpy.run_path({str(WORKER_PATH)!r}, run_name='am_worker_probe')\n"
        "import tradingagents\n"
        "print(tradingagents.__file__)\n"
    )
    out = subprocess.run(
        [sys.executable, "-c", probe], cwd=tmp_path, capture_output=True, text=True, check=True, timeout=120
    )
    loaded = Path(out.stdout.strip().splitlines()[-1]).resolve()
    assert loaded == (ROOT / "tradingagents" / "__init__.py").resolve()
