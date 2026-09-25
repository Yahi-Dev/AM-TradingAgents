#!/usr/bin/env python3
"""Worker local de AM-TradingAgents para Supabase.

La web app (Vercel) solo encola ``trading_runs`` en Supabase; este worker corre
en el PC del owner, reclama los runs ``QUEUED``, ejecuta el grafo upstream de
TradingAgents contra el modelo local (llama-swap, OpenAI-compatible) y publica
el progreso y los resultados de vuelta en Supabase vía PostgREST.

Uso::

    python scripts/supabase_worker.py            # bucle de sondeo continuo
    python scripts/supabase_worker.py --once     # procesa como mucho un run y sale
    python scripts/supabase_worker.py --poll 30  # sondeo cada 30 s

Configuración (``.env`` local, nunca en git): ``SUPABASE_URL`` (``https://``),
``SUPABASE_SERVICE_ROLE_KEY``, ``AM_LLM_PROVIDER`` (``openai``), ``AM_BACKEND_URL``
(``http://127.0.0.1:8080/v1``), ``AM_DEEP_MODEL`` / ``AM_QUICK_MODEL``
(``qwen3.8-27b``) y ``AM_WORKER_POLL_SECONDS`` (``10``). Opcionales:
``AM_WORKER_TENANT_IDS`` (IDs de workspace separados por comas: el worker solo
procesa runs de esos workspaces; recomendado) y ``TRADINGAGENTS_OUTPUT_LANGUAGE``
(idioma de los informes, p. ej. ``Spanish``; lo lee TradingAgents).

Reglas que este worker respeta:

* No envía órdenes: no importa ``tradingagents.execution`` ni ningún broker/OMS.
  Solo produce análisis (reportes y una decisión con rating).
* No persiste chain-of-thought: guarda únicamente los campos de reporte que el
  grafo ya produce y elimina bloques ``<think>`` si el modelo los filtrara.
* La service role key solo se usa aquí, desde el entorno local; nunca se escribe
  en logs, errores ni en la base de datos.
* Un run ``CANCELLED`` (o reasignado) nunca se sobrescribe; con el kill switch
  del tenant activo no se reclaman runs y el run en curso se cancela.
"""

from __future__ import annotations

import argparse
import contextlib
import copy
import logging
import os
import re
import signal
import socket
import sys
import threading
import time
from collections.abc import Callable, Iterable, Iterator, Mapping
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Protocol
from urllib.parse import urlsplit, urlunsplit

import requests

ROOT = Path(__file__).resolve().parent.parent
WORKER_VERSION = "1.0.0"

# Con ``python scripts/supabase_worker.py`` sys.path[0] es scripts/, no la raíz:
# ``import tradingagents`` cargaría la copia instalada en el entorno (quizá una
# versión antigua de PyPI o un ``pip install .`` anterior a un ``git pull``). Se
# antepone la raíz del repo para ejecutar siempre el tradingagents de esta rama.
if (ROOT / "tradingagents" / "__init__.py").is_file() and sys.path[:1] != [str(ROOT)]:
    sys.path.insert(0, str(ROOT))

log = logging.getLogger("am.supabase_worker")

# ---------------------------------------------------------------------------
# Contrato de datos
# ---------------------------------------------------------------------------

ANALYST_KEYS: tuple[str, ...] = ("market", "social", "news", "fundamentals")
POST_ANALYST_KEYS: tuple[str, ...] = (
    "bull",
    "bear",
    "research_manager",
    "trader",
    "aggressive",
    "conservative",
    "neutral",
    "portfolio_manager",
)
AGENT_LABELS: dict[str, str] = {
    "market": "Analista de mercado",
    "social": "Analista de sentimiento",
    "news": "Analista de noticias",
    "fundamentals": "Analista fundamental",
    "bull": "Investigador alcista",
    "bear": "Investigador bajista",
    "research_manager": "Research Manager",
    "trader": "Trader",
    "aggressive": "Riesgo agresivo",
    "conservative": "Riesgo conservador",
    "neutral": "Riesgo neutral",
    "portfolio_manager": "Portfolio Manager",
}

ALLOWED_MODES = frozenset({"BACKTEST", "PAPER", "SHADOW"})
RATING_MAP: dict[str, str] = {
    "buy": "BUY",
    "overweight": "OVERWEIGHT",
    "hold": "HOLD",
    "underweight": "UNDERWEIGHT",
    "sell": "SELL",
}
RATING_REVIEW = "REVIEW"

# Igual que cli/utils.CRYPTO_SUFFIXES: un símbolo canónico con estos sufijos es
# cripto, y el CLI quita el analista fundamental para ese tipo de activo.
CRYPTO_SUFFIXES: tuple[str, ...] = ("-USD", "-USDT", "-USDC", "-BTC", "-ETH")

# http:// solo para un Supabase local; en cualquier otro host la service role key
# viajaría sin cifrar.
LOCAL_HOSTS = frozenset({"localhost", "127.0.0.1", "::1"})
_UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")

STALE_AFTER = timedelta(minutes=30)
STALE_RECOVERY_INTERVAL_S = 300.0
DEFAULT_HEARTBEAT_S = 30.0
MAX_REPORT_CHARS = 100_000
MAX_ERROR_CHARS = 1_000
HTTP_TIMEOUT_S = 30.0
_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Configuración
# ---------------------------------------------------------------------------


class ConfigError(RuntimeError):
    """Configuración local incompleta o inválida."""


@dataclass(frozen=True)
class WorkerSettings:
    supabase_url: str
    service_role_key: str = field(repr=False)
    llm_provider: str = "openai"
    backend_url: str = "http://127.0.0.1:8080/v1"
    deep_model: str = "qwen3.8-27b"
    quick_model: str = "qwen3.8-27b"
    poll_seconds: float = 10.0
    # Workspaces (tenant_id) cuyos runs puede reclamar este worker; vacío = todos.
    tenant_ids: tuple[str, ...] = ()

    @classmethod
    def from_env(cls, env: Mapping[str, str] | None = None) -> WorkerSettings:
        env = os.environ if env is None else env

        def get(name: str, default: str = "") -> str:
            return (env.get(name) or default).strip()

        url = get("SUPABASE_URL").rstrip("/")
        key = get("SUPABASE_SERVICE_ROLE_KEY")
        missing = [n for n, v in (("SUPABASE_URL", url), ("SUPABASE_SERVICE_ROLE_KEY", key)) if not v]
        if missing:
            raise ConfigError(
                "Faltan variables de entorno: " + ", ".join(missing)
                + ". Configúralas en el .env local (ver sección 'Supabase worker' de .env.example)."
            )
        parts = urlsplit(url)
        host = (parts.hostname or "").lower()
        secure = parts.scheme == "https" and bool(host)
        local = parts.scheme == "http" and host in LOCAL_HOSTS
        if not (secure or local):
            raise ConfigError(
                "SUPABASE_URL debe empezar por https:// (p. ej. https://<ref>.supabase.co); "
                "http:// solo se admite para un Supabase local (localhost)")
        tenant_ids = parse_tenant_ids(get("AM_WORKER_TENANT_IDS"))
        raw_poll = get("AM_WORKER_POLL_SECONDS", "10")
        try:
            poll = float(raw_poll)
        except ValueError as exc:
            raise ConfigError(f"AM_WORKER_POLL_SECONDS no es un número: {raw_poll!r}") from exc
        if poll <= 0:
            raise ConfigError("AM_WORKER_POLL_SECONDS debe ser > 0")
        return cls(
            supabase_url=url,
            service_role_key=key,
            llm_provider=get("AM_LLM_PROVIDER", "openai").lower(),
            backend_url=get("AM_BACKEND_URL", "http://127.0.0.1:8080/v1"),
            deep_model=get("AM_DEEP_MODEL", "qwen3.8-27b"),
            quick_model=get("AM_QUICK_MODEL", "qwen3.8-27b"),
            poll_seconds=poll,
            tenant_ids=tenant_ids,
        )


def parse_tenant_ids(raw: str) -> tuple[str, ...]:
    """``AM_WORKER_TENANT_IDS``: UUIDs separados por comas o espacios (sin duplicados)."""
    ids: list[str] = []
    for token in re.split(r"[\s,;]+", raw.strip()):
        if not token:
            continue
        value = token.lower()
        if not _UUID_RE.match(value):
            raise ConfigError(
                f"AM_WORKER_TENANT_IDS contiene un ID de workspace no válido: {token[:60]!r} "
                "(usa el UUID que muestra Configuración > Worker local)")
        if value not in ids:
            ids.append(value)
    return tuple(ids)


def _is_native_openai(url: str | None) -> bool:
    if not url:
        return True
    host = urlsplit(url if "://" in url else "https://" + url).hostname or ""
    return host == "api.openai.com"


def effective_provider(settings: WorkerSettings) -> str:
    """Proveedor upstream efectivo.

    ``AM_LLM_PROVIDER=openai`` apuntando a un endpoint que no es api.openai.com
    (llama-swap local) se ejecuta con el proveedor upstream ``openai_compatible``:
    habla Chat Completions, no exige ``OPENAI_API_KEY`` (evita enviarla a un
    servidor ajeno a OpenAI) y no fuerza ``tool_choice`` (incompatible con
    llama.cpp/vLLM, #1057).
    """
    provider = settings.llm_provider or "openai"
    if provider == "openai" and not _is_native_openai(settings.backend_url):
        return "openai_compatible"
    return provider


def redact_url(url: str | None) -> str | None:
    """Quita credenciales (user:pass@), query y fragmento de una URL."""
    if not url:
        return url
    parts = urlsplit(url)
    netloc = parts.netloc.rsplit("@", 1)[-1]
    return urlunsplit((parts.scheme, netloc, parts.path, "", ""))


def tradingagents_version() -> str:
    try:
        from importlib.metadata import version

        return version("tradingagents")
    except Exception:
        return "unknown"


# ---------------------------------------------------------------------------
# Saneado de contenido (sin chain-of-thought, sin secretos)
# ---------------------------------------------------------------------------

_THINK_BLOCK_RE = re.compile(r"<think(?:ing)?>.*?</think(?:ing)?>", re.IGNORECASE | re.DOTALL)
_THINK_OPEN_RE = re.compile(r"<think(?:ing)?>", re.IGNORECASE)
_THINK_CLOSE_RE = re.compile(r"</think(?:ing)?>", re.IGNORECASE)


def strip_reasoning(text: str | None) -> str:
    """Elimina razonamiento privado (``<think>...</think>``) de un texto de reporte.

    Cubre bloques completos, un cierre huérfano (plantillas Qwen3 que ya abren
    ``<think>`` en el prompt: todo lo anterior al último ``</think>`` es
    razonamiento) y una apertura sin cierre (se descarta desde ahí).
    """
    if not text:
        return ""
    out = _THINK_BLOCK_RE.sub("", str(text))
    closes = list(_THINK_CLOSE_RE.finditer(out))
    if closes:
        out = out[closes[-1].end():]
    opening = _THINK_OPEN_RE.search(out)
    if opening:
        out = out[: opening.start()]
    return out.strip()


def clip(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    return text[: max(0, limit - 20)].rstrip() + "\n\n[... truncado ...]"


_SECRET_PATTERNS = (
    re.compile(r"(?i)(bearer\s+)[A-Za-z0-9._\-]+"),
    re.compile(r"(?i)((?:apikey|api_key|api-key|authorization|password|secret|token)[\"']?\s*[:=]\s*[\"']?)[^\s\"',}]+"),
    re.compile(r"eyJ[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]+"),  # JWT
    re.compile(r"\b(?:sk|sb_secret|sb_publishable)[-_][A-Za-z0-9_\-]{8,}"),
    re.compile(r"(://)[^/\s:@]+:[^/\s@]+@"),  # credenciales en URLs
)


def sanitize_error(exc: BaseException | str, secrets: Iterable[str] = ()) -> str:
    """Mensaje de error apto para la BD: sin secretos y truncado."""
    text = f"{type(exc).__name__}: {exc}" if isinstance(exc, BaseException) else str(exc)
    for secret in secrets:
        if secret and len(secret) >= 6:
            text = text.replace(secret, "[REDACTADO]")
    for pattern in _SECRET_PATTERNS:
        if pattern.groups:
            text = pattern.sub(lambda m: m.group(1) + "[REDACTADO]", text)
        else:
            text = pattern.sub("[REDACTADO]", text)
    return clip(text.strip() or "Error desconocido", MAX_ERROR_CHARS)


# ---------------------------------------------------------------------------
# Mapeo del estado upstream -> agentes del contrato
# ---------------------------------------------------------------------------


def _text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, list):
        return "\n".join(str(v) for v in value)
    return str(value)


def extract_agent_reports(state: Mapping[str, Any]) -> dict[str, str]:
    """Reportes estructurados por agente a partir del estado del grafo.

    Solo campos de reporte (nunca mensajes/tool calls ni razonamiento):
    ``market_report``, ``sentiment_report``, ``news_report``,
    ``fundamentals_report``, ``investment_debate_state.{bull,bear}_history``,
    ``investment_debate_state.judge_decision`` (Research Manager, alias de
    ``investment_plan``), ``trader_investment_plan``,
    ``risk_debate_state.{aggressive,conservative,neutral}_history`` y
    ``final_trade_decision`` (Portfolio Manager).
    """
    debate = state.get("investment_debate_state") or {}
    risk = state.get("risk_debate_state") or {}
    raw = {
        "market": state.get("market_report"),
        "social": state.get("sentiment_report"),
        "news": state.get("news_report"),
        "fundamentals": state.get("fundamentals_report"),
        "bull": debate.get("bull_history"),
        "bear": debate.get("bear_history"),
        "research_manager": debate.get("judge_decision") or state.get("investment_plan"),
        "trader": state.get("trader_investment_plan"),
        "aggressive": risk.get("aggressive_history"),
        "conservative": risk.get("conservative_history"),
        "neutral": risk.get("neutral_history"),
        "portfolio_manager": state.get("final_trade_decision") or risk.get("judge_decision"),
    }
    reports: dict[str, str] = {}
    for agent, value in raw.items():
        content = strip_reasoning(_text(value))
        if content:
            reports[agent] = clip(content, MAX_REPORT_CHARS)
    return reports


def parse_final_rating(decision_text: str | None) -> str:
    """Rating del contrato (BUY/OVERWEIGHT/HOLD/UNDERWEIGHT/SELL) o ``REVIEW``.

    Usa el parser upstream (``tradingagents.agents.utils.rating.extract_rating``,
    el mismo que ``SignalProcessor.process_signal``): una decisión sin rating
    legible es ``REVIEW``, nunca un ``HOLD`` fabricado (#1170).
    """
    if not decision_text:
        return RATING_REVIEW
    from tradingagents.agents.utils.rating import extract_rating

    rating = extract_rating(decision_text)
    if not rating:
        return RATING_REVIEW
    return RATING_MAP.get(str(rating).strip().lower(), RATING_REVIEW)


def normalize_trading_symbol(symbol: str) -> str:
    try:
        from tradingagents.dataflows.symbol_utils import normalize_symbol

        return normalize_symbol(symbol)
    except Exception:
        return symbol.strip().upper()


def detect_asset_type(symbol: str) -> str:
    return "crypto" if normalize_trading_symbol(symbol).endswith(CRYPTO_SUFFIXES) else "stock"


def effective_analysts(run_analysts: Iterable[str] | None, asset_type: str) -> list[str]:
    """Analistas del run en el orden canónico del grafo (como el CLI).

    Para cripto se quita ``fundamentals`` (``cli.utils.filter_analysts_for_asset_type``).
    """
    wanted = {str(a).strip().lower() for a in (run_analysts or ANALYST_KEYS)}
    unknown = wanted.difference(ANALYST_KEYS)
    if unknown:
        raise ValueError("Analistas desconocidos: " + ", ".join(sorted(unknown)))
    selected = [a for a in ANALYST_KEYS if a in wanted]
    if asset_type == "crypto":
        selected = [a for a in selected if a != "fundamentals"]
    return selected


# ---------------------------------------------------------------------------
# Cliente PostgREST (service role)
# ---------------------------------------------------------------------------


class SupabaseError(RuntimeError):
    def __init__(self, status: int, message: str, code: str | None = None):
        super().__init__(f"HTTP {status}: {message}")
        self.status = status
        self.code = code


class SupabaseRest:
    """Cliente mínimo de PostgREST (``SUPABASE_URL/rest/v1``) con la service role key.

    ``session`` es inyectable (tests); debe exponer
    ``request(method, url, params=, json=, headers=, timeout=)``.
    """

    def __init__(self, url: str, service_role_key: str, session: Any = None,
                 timeout: float = HTTP_TIMEOUT_S):
        self.base_url = url.rstrip("/") + "/rest/v1"
        self._key = service_role_key
        self._session = session if session is not None else requests.Session()
        self._timeout = timeout
        self._lock = threading.Lock()  # el hilo de latido comparte la sesión

    def __repr__(self) -> str:  # nunca exponer la key
        return f"SupabaseRest({self.base_url!r})"

    @property
    def secrets(self) -> tuple[str, ...]:
        return (self._key,)

    def _headers(self, prefer: str | None) -> dict[str, str]:
        headers = {
            "apikey": self._key,
            "Authorization": f"Bearer {self._key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        if prefer:
            headers["Prefer"] = prefer
        return headers

    def request(self, method: str, path: str, *, params: Mapping[str, str] | None = None,
                json: Any = None, prefer: str | None = None) -> Any:
        url = f"{self.base_url}/{path.lstrip('/')}"
        try:
            with self._lock:
                # Sin redirecciones: requests conservaría la cabecera ``apikey``
                # (service role) aunque la redirección cambie de host.
                resp = self._session.request(
                    method, url, params=dict(params or {}), json=json,
                    headers=self._headers(prefer), timeout=self._timeout,
                    allow_redirects=False,
                )
        except requests.RequestException as exc:
            # El mensaje de requests no incluye cabeceras, pero se sanea igual.
            raise SupabaseError(0, sanitize_error(exc, self.secrets)) from None
        status = int(resp.status_code)
        if 300 <= status < 400:
            raise SupabaseError(status, "redirección no permitida: revisa SUPABASE_URL "
                                        "(debe ser https://<ref>.supabase.co)")
        if status >= 400:
            code, message = None, ""
            try:
                body = resp.json()
                if isinstance(body, dict):
                    code = body.get("code")
                    message = " | ".join(
                        str(body[k]) for k in ("message", "details", "hint") if body.get(k)
                    )
            except ValueError:
                message = (getattr(resp, "text", "") or "")[:300]
            raise SupabaseError(status, sanitize_error(message or "error", self.secrets), code)
        if status == 204 or not getattr(resp, "content", b""):
            return None
        try:
            return resp.json()
        except ValueError:
            return None

    # -- helpers --------------------------------------------------------------

    def select(self, table: str, params: Mapping[str, str]) -> list[dict]:
        return self.request("GET", table, params=params) or []

    def insert(self, table: str, rows: dict | list[dict]) -> None:
        self.request("POST", table, json=rows, prefer="return=minimal")

    def upsert(self, table: str, rows: dict | list[dict], on_conflict: str,
               ignore_duplicates: bool = False) -> None:
        resolution = "ignore-duplicates" if ignore_duplicates else "merge-duplicates"
        self.request("POST", table, params={"on_conflict": on_conflict}, json=rows,
                     prefer=f"resolution={resolution},return=minimal")

    def update(self, table: str, filters: Mapping[str, str], values: dict) -> list[dict]:
        return self.request("PATCH", table, params=filters, json=values,
                            prefer="return=representation") or []

    def rpc(self, function: str, args: dict) -> Any:
        return self.request("POST", f"rpc/{function}", json=args)


# ---------------------------------------------------------------------------
# Ejecución del grafo upstream
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class GraphJob:
    run_id: str
    symbol: str
    trade_date: str
    analysts: tuple[str, ...]
    asset_type: str


class AnalysisSession(Protocol):
    def stream(self) -> Iterator[Mapping[str, Any]]: ...

    def finalize(self, final_state: Mapping[str, Any]) -> None: ...

    def close(self) -> None: ...


class GraphRunner(Protocol):
    def open(self, job: GraphJob) -> AnalysisSession: ...

    def model_versions(self) -> dict[str, Any]: ...


class TradingAgentsRunner:
    """Construye ``TradingAgentsGraph`` y hace stream igual que ``cli/main.py``."""

    def __init__(self, settings: WorkerSettings):
        self.settings = settings

    def build_config(self) -> dict[str, Any]:
        from tradingagents.default_config import DEFAULT_CONFIG

        config = copy.deepcopy(DEFAULT_CONFIG)
        config["llm_provider"] = effective_provider(self.settings)
        config["backend_url"] = self.settings.backend_url or None
        config["deep_think_llm"] = self.settings.deep_model
        config["quick_think_llm"] = self.settings.quick_model
        return config

    def model_versions(self) -> dict[str, Any]:
        return {
            "provider": self.settings.llm_provider,
            "effective_provider": effective_provider(self.settings),
            "deep_model": self.settings.deep_model,
            "quick_model": self.settings.quick_model,
            "backend_url": redact_url(self.settings.backend_url),
        }

    def open(self, job: GraphJob) -> _TradingAgentsSession:
        from tradingagents.graph.trading_graph import TradingAgentsGraph

        graph = TradingAgentsGraph(selected_analysts=list(job.analysts), config=self.build_config())
        return _TradingAgentsSession(graph, job, normalize_trading_symbol(job.symbol))


class _TradingAgentsSession:
    def __init__(self, graph: Any, job: GraphJob, symbol: str):
        self.graph = graph
        self.job = job
        self.symbol = symbol
        self._checkpoint_open = False

    def stream(self) -> Iterator[Mapping[str, Any]]:
        graph, job = self.graph, self.job
        # Mismo estado inicial que propagate() y el CLI: log de decisiones,
        # contexto pasado e identidad del instrumento.
        init_state = graph.create_run_state(self.symbol, job.trade_date, job.asset_type)
        args = graph.propagator.get_graph_args()
        thread = graph.begin_checkpoint(self.symbol, job.trade_date, job.asset_type)
        self._checkpoint_open = True
        if thread is not None:
            args.setdefault("config", {}).setdefault("configurable", {})["thread_id"] = thread
        yield from graph.graph.stream(graph.checkpoint_input(init_state), **args)

    def finalize(self, final_state: Mapping[str, Any]) -> None:
        # Como propagate(): registra la decisión para la reflexión del próximo
        # run del mismo ticker y limpia el checkpoint.
        self.graph.record_decision(self.symbol, self.job.trade_date, dict(final_state))
        self.graph.clear_checkpoint_on_success(self.symbol, self.job.trade_date, self.job.asset_type)

    def close(self) -> None:
        if self._checkpoint_open:
            self._checkpoint_open = False
            self.graph.end_checkpoint()


# ---------------------------------------------------------------------------
# Worker
# ---------------------------------------------------------------------------


class RunInterrupted(Exception):
    """El run dejó de pertenecer a este worker (cancelado, kill switch...)."""

    def __init__(self, reason: str, detail: str = ""):
        super().__init__(detail or reason)
        self.reason = reason


class _RunMonitor:
    """Latido (``heartbeat_at``) y detección de cancelación / kill switch.

    ``beat()`` se llama entre chunks del grafo y, opcionalmente, desde un hilo
    en segundo plano para que el latido siga vivo durante llamadas largas al LLM.
    """

    def __init__(self, worker: SupabaseWorker, run: Mapping[str, Any], interval: float,
                 use_thread: bool):
        self.worker = worker
        self.run = run
        self.interval = max(0.0, interval)
        self.use_thread = use_thread and interval > 0
        self.stop_reason: str | None = None
        self._last = time.monotonic()
        self._lock = threading.Lock()
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        if self.use_thread:
            self._thread = threading.Thread(target=self._loop, name="am-heartbeat", daemon=True)
            self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout=5)

    def _loop(self) -> None:
        while not self._stop.wait(self.interval):
            try:
                self.beat(force=True)
            except Exception as exc:  # el latido nunca debe tumbar el run
                log.warning("Latido fallido para %s: %s", self.run["id"],
                            sanitize_error(exc, self.worker.rest.secrets))

    def beat(self, force: bool = False) -> str | None:
        with self._lock:
            if self.stop_reason:
                return self.stop_reason
            now = time.monotonic()
            if not force and now - self._last < self.interval:
                return None
            self._last = now
            reason = self.worker._heartbeat(self.run)
            if reason:
                self.stop_reason = reason
            return reason


class SupabaseWorker:
    def __init__(
        self,
        rest: SupabaseRest,
        settings: WorkerSettings,
        runner: GraphRunner,
        *,
        hostname: str | None = None,
        worker_id: str | None = None,
        heartbeat_seconds: float = DEFAULT_HEARTBEAT_S,
        heartbeat_thread: bool = True,
        sleep: Callable[[float], None] = time.sleep,
        now: Callable[[], datetime] = utc_now,
    ):
        self.rest = rest
        self.settings = settings
        self.runner = runner
        self.hostname = hostname or socket.gethostname() or "worker"
        self.worker_id = (worker_id or f"{self.hostname}-{os.getpid()}")[:200]
        self.heartbeat_seconds = heartbeat_seconds
        self.heartbeat_thread = heartbeat_thread
        self._sleep = sleep
        self._now = now
        self._rpc_claim: bool | None = None  # None = aún no probado
        self._last_recovery = 0.0

    # -- utilidades -----------------------------------------------------------

    def _event(self, run: Mapping[str, Any], event_type: str, agent: str | None = None,
               payload: dict | None = None) -> None:
        self.rest.insert("run_events", {
            "run_id": run["id"],
            "tenant_id": run["tenant_id"],
            "correlation_id": run.get("correlation_id"),
            "event_type": event_type,
            "agent": agent,
            "payload": payload or {},
        })

    def _event_quiet(self, run: Mapping[str, Any], event_type: str, **kwargs: Any) -> None:
        try:
            self._event(run, event_type, **kwargs)
        except Exception as exc:
            log.warning("No se pudo registrar el evento %s del run %s: %s", event_type,
                        run.get("id"), sanitize_error(exc, self.rest.secrets))

    def _owned_filter(self, run_id: str) -> dict[str, str]:
        return {"id": f"eq.{run_id}", "status": "eq.RUNNING", "worker_id": f"eq.{self.worker_id}"}

    def _kill_switch_tenants(self, tenant_ids: Iterable[str]) -> set[str]:
        ids = sorted({str(t) for t in tenant_ids if t})
        if not ids:
            return set()
        rows = self.rest.select("tenant_settings", {
            "select": "tenant_id,kill_switch_active",
            "tenant_id": f"in.({','.join(ids)})",
        })
        return {str(r["tenant_id"]) for r in rows if r.get("kill_switch_active")}

    # -- recuperación de runs huérfanos -----------------------------------------

    def recover_stale_runs(self) -> int:
        """Marca FAILED los runs RUNNING de este host con latido de hace > 30 min."""
        self._last_recovery = time.monotonic()
        cutoff = iso(self._now() - STALE_AFTER)
        rows = self.rest.select("trading_runs", {
            "select": "id,tenant_id,correlation_id,worker_id,heartbeat_at",
            "status": "eq.RUNNING",
            "worker_id": f"like.{self.hostname}-*",
            "heartbeat_at": f"lt.{cutoff}",
        })
        recovered = 0
        for run in rows:
            owner = str(run.get("worker_id") or "")
            if owner == self.worker_id or owner.rsplit("-", 1)[0] != self.hostname:
                continue
            updated = self.rest.update(
                "trading_runs",
                {"id": f"eq.{run['id']}", "status": "eq.RUNNING", "worker_id": f"eq.{owner}"},
                {"status": "FAILED", "error": "worker reiniciado", "finished_at": iso(self._now())},
            )
            if updated:
                recovered += 1
                self._event_quiet(run, "RunFailed",
                                  payload={"error": "worker reiniciado", "stale_worker_id": owner})
                log.warning("Run %s marcado FAILED: worker reiniciado (%s)", run["id"], owner)
        return recovered

    def maybe_recover_stale_runs(self) -> None:
        if time.monotonic() - self._last_recovery >= STALE_RECOVERY_INTERVAL_S:
            self.recover_stale_runs()

    # -- reclamo ------------------------------------------------------------------

    def claim_next_run(self) -> dict | None:
        """Reclama atómicamente el run QUEUED más antiguo (o ``None``).

        Con ``AM_WORKER_TENANT_IDS`` solo se consideran los runs de esos
        workspaces (PATCH condicional filtrado por ``tenant_id``).
        """
        if self.settings.tenant_ids:
            return self._claim_with_patch()
        if self._rpc_claim is not False:
            try:
                rows = self.rest.rpc("worker_claim_trading_run", {"p_worker_id": self.worker_id})
                self._rpc_claim = True
                if isinstance(rows, dict):
                    rows = [rows]
                rows = [r for r in (rows or []) if r and r.get("id")]
                return rows[0] if rows else None
            except SupabaseError as exc:
                if exc.status == 404 or exc.code == "PGRST202":
                    log.info("RPC worker_claim_trading_run no disponible; uso PATCH condicional.")
                    self._rpc_claim = False
                else:
                    raise
        return self._claim_with_patch()

    def _claim_with_patch(self) -> dict | None:
        params = {
            "select": "*",
            "status": "eq.QUEUED",
            "order": "created_at.asc",
            "limit": "10",
        }
        if self.settings.tenant_ids:
            params["tenant_id"] = f"in.({','.join(self.settings.tenant_ids)})"
        candidates = self.rest.select("trading_runs", params)
        if not candidates:
            return None
        blocked = self._kill_switch_tenants(r["tenant_id"] for r in candidates)
        for run in candidates:
            if str(run["tenant_id"]) in blocked:
                continue
            now = iso(self._now())
            claimed = self.rest.update(
                "trading_runs",
                {"id": f"eq.{run['id']}", "status": "eq.QUEUED"},
                {"status": "RUNNING", "worker_id": self.worker_id, "started_at": now,
                 "heartbeat_at": now, "error": None},
            )
            if claimed:
                return claimed[0]
            log.info("Run %s ya reclamado por otro worker; se omite.", run["id"])
        return None

    # -- latido / cancelación -------------------------------------------------------

    def _heartbeat(self, run: Mapping[str, Any]) -> str | None:
        """Actualiza ``heartbeat_at``; devuelve un motivo de parada o ``None``."""
        rows = self.rest.update("trading_runs", self._owned_filter(run["id"]),
                                {"heartbeat_at": iso(self._now())})
        if not rows:
            current = self._fetch_run(run["id"])
            status = (current or {}).get("status")
            return "cancelled" if status == "CANCELLED" else "lost"
        if run["tenant_id"] and self._kill_switch_tenants([run["tenant_id"]]):
            return "kill_switch"
        return None

    def _fetch_run(self, run_id: str) -> dict | None:
        rows = self.rest.select("trading_runs", {
            "select": "id,status,worker_id", "id": f"eq.{run_id}", "limit": "1",
        })
        return rows[0] if rows else None

    def _still_owned(self, run_id: str) -> tuple[bool, str | None]:
        current = self._fetch_run(run_id)
        if not current:
            return False, None
        status = current.get("status")
        return status == "RUNNING" and current.get("worker_id") == self.worker_id, status

    # -- procesamiento ------------------------------------------------------------

    def run_once(self) -> bool:
        """Reclama y procesa como mucho un run. ``True`` si procesó alguno."""
        run = self.claim_next_run()
        if not run:
            return False
        self.process_run(run)
        return True

    def process_run(self, run: dict) -> str:
        """Ejecuta el análisis de un run ya reclamado. Devuelve el estado final."""
        run_id = run["id"]
        started = time.monotonic()
        log.info("Run %s reclamado: %s @ %s (%s)", run_id, run.get("symbol"),
                 run.get("trade_date"), run.get("mode"))
        monitor = _RunMonitor(self, run, self.heartbeat_seconds, self.heartbeat_thread)
        try:
            job = self._build_job(run)
            self._event(run, "RunStarted", payload={
                "worker_id": self.worker_id,
                "symbol": run.get("symbol"),
                "trade_date": job.trade_date,
                "mode": run.get("mode"),
                "analysts": list(job.analysts),
                "asset_type": job.asset_type,
                **{k: v for k, v in self.runner.model_versions().items() if k != "backend_url"},
            })
            monitor.start()
            final_state, session = self._stream(run, job, monitor)
            return self._complete(run, job, final_state, session, started)
        except RunInterrupted as stop:
            return self._handle_interruption(run, stop)
        except KeyboardInterrupt:
            self._fail(run, "worker detenido manualmente (Ctrl+C)")
            raise
        except Exception as exc:
            log.exception("Run %s falló", run_id)
            return self._fail(run, sanitize_error(exc, self.rest.secrets))
        finally:
            monitor.stop()

    def _build_job(self, run: Mapping[str, Any]) -> GraphJob:
        mode = str(run.get("mode") or "")
        if mode not in ALLOWED_MODES:  # defensa en profundidad: LIVE es imposible
            raise ValueError(f"Modo no permitido en este despliegue: {mode!r}")
        trade_date = str(run.get("trade_date") or "")[:10]
        if not _DATE_RE.match(trade_date):
            raise ValueError(f"trade_date inválida: {run.get('trade_date')!r}")
        symbol = str(run.get("symbol") or "").strip().upper()
        if not symbol:
            raise ValueError("El run no tiene símbolo")
        asset_type = detect_asset_type(symbol)
        analysts = effective_analysts(run.get("analysts"), asset_type)
        if not analysts:
            raise ValueError("Ningún analista aplicable (el analista fundamental no aplica a cripto)")
        return GraphJob(str(run["id"]), symbol, trade_date, tuple(analysts), asset_type)

    def _stream(self, run: dict, job: GraphJob,
                monitor: _RunMonitor) -> tuple[dict[str, Any], AnalysisSession]:
        # Orden real del grafo: analistas elegidos -> debate alcista/bajista ->
        # Research Manager -> Trader -> riesgo agresivo/conservador/neutral -> PM.
        # El stream solo expone salidas, así que 'AgentStarted' del siguiente
        # agente se emite cuando el anterior publica su reporte.
        pipeline = list(job.analysts) + list(POST_ANALYST_KEYS)
        started: set[str] = set()
        published: dict[str, str] = {}
        revisions: dict[str, int] = {}

        def start_agent(agent: str) -> None:
            if agent not in started:
                started.add(agent)
                self._event(run, "AgentStarted", agent=agent,
                            payload={"agent": agent, "label": AGENT_LABELS[agent]})

        start_agent(pipeline[0])
        session = self.runner.open(job)
        final_state: dict[str, Any] = {}
        chunks = session.stream()
        try:
            for chunk in chunks:
                if isinstance(chunk, Mapping):
                    final_state.update(chunk)
                reports = extract_agent_reports(final_state)
                for index, agent in enumerate(pipeline):
                    content = reports.get(agent)
                    if not content or published.get(agent) == content:
                        continue
                    start_agent(agent)
                    self.rest.upsert("agent_reports", {
                        "run_id": run["id"],
                        "tenant_id": run["tenant_id"],
                        "agent": agent,
                        "title": AGENT_LABELS[agent],
                        "content": content,
                    }, on_conflict="run_id,agent")
                    published[agent] = content
                    revisions[agent] = revisions.get(agent, 0) + 1
                    self._event(run, "AgentReportPublished", agent=agent, payload={
                        "agent": agent, "label": AGENT_LABELS[agent],
                        "chars": len(content), "revision": revisions[agent],
                    })
                    if index + 1 < len(pipeline):
                        start_agent(pipeline[index + 1])
                reason = monitor.beat()
                if reason:
                    raise RunInterrupted(reason)
        finally:
            closer = getattr(chunks, "close", None)
            if callable(closer):
                closer()  # corta el stream de LangGraph si se interrumpió
            session.close()
        if monitor.stop_reason:
            raise RunInterrupted(monitor.stop_reason)
        return final_state, session

    def _complete(self, run: dict, job: GraphJob, final_state: Mapping[str, Any],
                  session: AnalysisSession, started: float) -> str:
        owned, status = self._still_owned(run["id"])
        if not owned:
            raise RunInterrupted("cancelled" if status == "CANCELLED" else "lost")
        reports = extract_agent_reports(final_state)
        decision = reports.get("portfolio_manager", "")
        if not decision:
            raise RuntimeError("El grafo terminó sin decisión final del Portfolio Manager")
        rating = parse_final_rating(decision)
        finished = iso(self._now())
        updated = self.rest.update("trading_runs", self._owned_filter(run["id"]), {
            "status": "COMPLETED",
            "final_rating": rating,
            "final_decision": decision,
            "finished_at": finished,
            "heartbeat_at": finished,
            "error": None,
        })
        if not updated:
            raise RunInterrupted("lost", "el run cambió de estado antes de completarse")
        try:
            session.finalize(final_state)
        except Exception as exc:
            log.warning("No se pudo registrar la decisión en la memoria local: %s",
                        sanitize_error(exc, self.rest.secrets))
        trace_ok = True
        try:
            self.rest.upsert("decision_traces", {
                "run_id": run["id"],
                "tenant_id": run["tenant_id"],
                "summary": {
                    "symbol": run.get("symbol"),
                    "trade_date": job.trade_date,
                    "mode": run.get("mode"),
                    "final_rating": rating,
                    "analysts": list(job.analysts),
                    "report_agents": [a for a in (*ANALYST_KEYS, *POST_ANALYST_KEYS) if a in reports],
                    "asset_type": job.asset_type,
                },
                "model_versions": self.runner.model_versions(),
                "prompt_versions": {
                    "tradingagents": tradingagents_version(),
                    "supabase_worker": WORKER_VERSION,
                },
            }, on_conflict="run_id", ignore_duplicates=True)
        except Exception as exc:
            trace_ok = False
            log.error("No se pudo guardar decision_traces del run %s: %s", run["id"],
                      sanitize_error(exc, self.rest.secrets))
        self._event_quiet(run, "RunCompleted", payload={
            "final_rating": rating,
            "duration_seconds": round(time.monotonic() - started, 1),
            "reports": len(reports),
            "decision_trace": trace_ok,
        })
        log.info("Run %s COMPLETED: %s (%s)", run["id"], rating, run.get("symbol"))
        return "COMPLETED"

    def _handle_interruption(self, run: dict, stop: RunInterrupted) -> str:
        if stop.reason == "kill_switch":
            updated = self.rest.update("trading_runs", self._owned_filter(run["id"]), {
                "status": "CANCELLED",
                "error": "Kill switch activo: análisis detenido",
                "finished_at": iso(self._now()),
            })
            if updated:
                self._event_quiet(run, "RunCancelled", payload={"reason": "kill_switch"})
            log.warning("Run %s cancelado por kill switch del tenant", run["id"])
            return "CANCELLED"
        if stop.reason == "cancelled":
            log.info("Run %s cancelado por el usuario; no se sobrescribe.", run["id"])
            return "CANCELLED"
        log.warning("Run %s ya no pertenece a este worker (%s); se abandona.", run["id"], stop)
        return "LOST"

    def _fail(self, run: dict, error: str) -> str:
        try:
            updated = self.rest.update("trading_runs", self._owned_filter(run["id"]), {
                "status": "FAILED",
                "error": error,
                "finished_at": iso(self._now()),
            })
        except Exception as exc:
            log.error("No se pudo marcar FAILED el run %s: %s", run["id"],
                      sanitize_error(exc, self.rest.secrets))
            return "FAILED"
        if updated:
            self._event_quiet(run, "RunFailed", payload={"error": error})
            log.error("Run %s FAILED: %s", run["id"], error)
            return "FAILED"
        log.info("Run %s ya no estaba RUNNING al fallar; no se sobrescribe.", run["id"])
        return "LOST"

    # -- bucle principal -------------------------------------------------------------

    def run_forever(self, poll_seconds: float | None = None, once: bool = False) -> None:
        poll = poll_seconds or self.settings.poll_seconds
        log.info("Worker %s iniciado (sondeo %.0fs, modelo %s @ %s).", self.worker_id, poll,
                 self.settings.deep_model, redact_url(self.settings.backend_url))
        if self.settings.tenant_ids:
            log.info("Solo se procesan runs de %d workspace(s) (AM_WORKER_TENANT_IDS).",
                     len(self.settings.tenant_ids))
        else:
            log.warning(
                "AM_WORKER_TENANT_IDS no está definido: se procesan runs de CUALQUIER workspace. "
                "Define el ID de tu workspace (Configuración > Worker local) y mantén desactivado "
                "el registro público en Supabase (Authentication > Sign In / Providers).")
        try:
            self.recover_stale_runs()
        except Exception as exc:
            log.warning("Recuperación de runs huérfanos fallida: %s",
                        sanitize_error(exc, self.rest.secrets))
        while True:
            processed = False
            try:
                self.maybe_recover_stale_runs()
                processed = self.run_once()
            except KeyboardInterrupt:
                raise
            except Exception as exc:
                log.error("Error en el ciclo del worker: %s", sanitize_error(exc, self.rest.secrets))
            if once:
                if not processed:
                    log.info("No hay runs en cola.")
                return
            if not processed:
                self._sleep(poll)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def _load_env() -> None:
    try:
        from dotenv import find_dotenv, load_dotenv
    except ImportError:
        return
    load_dotenv(ROOT / ".env", override=False)
    load_dotenv(find_dotenv(usecwd=True), override=False)


def _install_sigterm() -> None:
    def handler(signum: int, frame: Any) -> None:
        raise KeyboardInterrupt

    for name in ("SIGTERM", "SIGBREAK"):
        sig = getattr(signal, name, None)
        if sig is not None:
            with contextlib.suppress(ValueError, OSError):
                signal.signal(sig, handler)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Worker local: procesa los TradingRuns encolados en Supabase con TradingAgents.")
    parser.add_argument("--once", action="store_true", help="procesa como mucho un run y sale")
    parser.add_argument("--poll", type=float, default=None, metavar="SECONDS",
                        help="segundos entre sondeos (por defecto AM_WORKER_POLL_SECONDS o 10)")
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO, stream=sys.stdout,
                        format="%(asctime)s [worker] %(levelname)s %(message)s")
    _load_env()
    try:
        settings = WorkerSettings.from_env()
    except ConfigError as exc:
        log.error("%s", exc)
        return 2
    if args.poll is not None and args.poll <= 0:
        log.error("--poll debe ser > 0")
        return 2

    rest = SupabaseRest(settings.supabase_url, settings.service_role_key)
    worker = SupabaseWorker(rest, settings, TradingAgentsRunner(settings))
    _install_sigterm()
    try:
        worker.run_forever(args.poll, once=args.once)
    except KeyboardInterrupt:
        log.info("Worker detenido (Ctrl+C).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
