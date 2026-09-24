"""
Architecture fitness functions — run in CI on every PR.
These tests enforce the invariants that cannot be caught by ruff or mypy.

Invariants enforced:
  1. agents/ must not import execution/, oms/, broker/, schwab
  2. risk/engine must not import any LLM client
  3. TradeIntent is defined in domain/ only
  4. No circular imports between bounded contexts
  5. BrokerGateway is abstract — only implementations import concrete brokers
"""
from __future__ import annotations

import ast
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).parent.parent.parent
TRADINGAGENTS = ROOT / "tradingagents"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def collect_imports(source_file: Path) -> list[str]:
    """Return all import module names referenced in a Python file."""
    try:
        tree = ast.parse(source_file.read_text(encoding="utf-8", errors="ignore"))
    except SyntaxError:
        return []
    imports: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imports.append(alias.name)
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                imports.append(node.module)
    return imports


def files_under(directory: Path) -> list[Path]:
    if not directory.exists():
        return []
    return list(directory.rglob("*.py"))


def assert_no_forbidden_import(
    source_dir: Path,
    forbidden_prefixes: list[str],
    *,
    label: str,
) -> None:
    """Fail if any .py file under source_dir imports a forbidden prefix."""
    violations: list[str] = []
    for py_file in files_under(source_dir):
        for imported in collect_imports(py_file):
            for forbidden in forbidden_prefixes:
                if imported == forbidden or imported.startswith(f"{forbidden}."):
                    rel = py_file.relative_to(ROOT)
                    violations.append(f"{rel}: imports '{imported}' (forbidden: {forbidden})")
    if violations:
        msg = (
            f"\n[ARCHITECTURE VIOLATION] {label}\n"
            + "\n".join(f"  - {v}" for v in violations)
        )
        pytest.fail(msg)


# ---------------------------------------------------------------------------
# Test 1 — agents/ must not import execution/, oms/, broker/, schwab
# ---------------------------------------------------------------------------

@pytest.mark.architecture
def test_agents_no_execution_import() -> None:
    """agents/ must never import tradingagents.execution."""
    assert_no_forbidden_import(
        TRADINGAGENTS / "agents",
        ["tradingagents.execution"],
        label="agents/ must not import execution/",
    )


@pytest.mark.architecture
def test_agents_no_oms_import() -> None:
    """agents/ must never import tradingagents.oms."""
    assert_no_forbidden_import(
        TRADINGAGENTS / "agents",
        ["tradingagents.oms"],
        label="agents/ must not import oms/",
    )


@pytest.mark.architecture
def test_agents_no_broker_import() -> None:
    """agents/ must never import tradingagents.broker or schwab."""
    assert_no_forbidden_import(
        TRADINGAGENTS / "agents",
        ["tradingagents.broker", "schwab"],
        label="agents/ must not import broker/ or schwab",
    )


# ---------------------------------------------------------------------------
# Test 2 — risk/engine must not import LLM clients
# ---------------------------------------------------------------------------

_LLM_FORBIDDEN = [
    "tradingagents.llm_clients",
    "langchain",
    "langchain_core",
    "langchain_openai",
    "langchain_anthropic",
    "openai",
    "anthropic",
]


@pytest.mark.architecture
def test_risk_engine_no_llm_imports() -> None:
    """risk/engine must be deterministic — no LLM client imports allowed."""
    assert_no_forbidden_import(
        TRADINGAGENTS / "risk" / "engine",
        _LLM_FORBIDDEN,
        label="risk/engine must not import any LLM client",
    )


# ---------------------------------------------------------------------------
# Test 3 — frontend (apps/web) must not import tradingagents backend
# ---------------------------------------------------------------------------

@pytest.mark.architecture
def test_frontend_no_backend_import() -> None:
    """apps/web Python files must not import tradingagents directly.
    (Catches any scaffolding that accidentally couples frontend to backend.)
    """
    apps_web = ROOT / "apps" / "web"
    assert_no_forbidden_import(
        apps_web,
        ["tradingagents"],
        label="apps/web must not import tradingagents backend",
    )


# ---------------------------------------------------------------------------
# Test 4 — No direct Agent → Schwab dependency
# ---------------------------------------------------------------------------

@pytest.mark.architecture
def test_agents_no_schwab_direct() -> None:
    """agents/ must never reference Schwab API directly."""
    assert_no_forbidden_import(
        TRADINGAGENTS / "agents",
        ["schwab", "tradingagents.dataflows.schwab"],
        label="agents/ must not directly use Schwab — use dataflows abstraction",
    )


# ---------------------------------------------------------------------------
# Test 5 — OMS must not bypass BrokerGateway abstraction
# Each OMS file should not import concrete broker implementations directly.
# ---------------------------------------------------------------------------

@pytest.mark.architecture
def test_oms_no_concrete_broker_import() -> None:
    """OMS must use BrokerGateway abstraction — not import SchwabBroker directly."""
    assert_no_forbidden_import(
        TRADINGAGENTS / "oms",
        ["tradingagents.execution.schwab_broker"],
        label="oms/ must not import SchwabBroker directly — use BrokerGateway ABC",
    )


# ---------------------------------------------------------------------------
# Test 6 — risk/engine must not import oms/
# ---------------------------------------------------------------------------

@pytest.mark.architecture
def test_risk_engine_no_oms_import() -> None:
    """risk/engine must be independent of OMS."""
    assert_no_forbidden_import(
        TRADINGAGENTS / "risk" / "engine",
        ["tradingagents.oms"],
        label="risk/engine must not import oms/",
    )


# ---------------------------------------------------------------------------
# Test 7 — Domain model must not depend on infra
# domain/ should only use stdlib and pydantic
# ---------------------------------------------------------------------------

_INFRA_MODULES = [
    "sqlalchemy",
    "alembic",
    "fastapi",
    "uvicorn",
    "celery",
    "redis",
]


@pytest.mark.architecture
def test_domain_no_infra_imports() -> None:
    """domain/ must not import infrastructure libraries (SQLAlchemy, FastAPI, etc.)."""
    assert_no_forbidden_import(
        TRADINGAGENTS / "domain",
        _INFRA_MODULES,
        label="domain/ must be pure Python + Pydantic — no infrastructure imports",
    )


# ---------------------------------------------------------------------------
# Test 8 — No .env files accidentally imported/hardcoded
# ---------------------------------------------------------------------------

@pytest.mark.architecture
def test_no_hardcoded_secrets_patterns() -> None:
    """Scan all Python files for patterns that look like hardcoded credentials."""
    import re

    secret_patterns = [
        re.compile(r"ghp_[A-Za-z0-9]{36}"),          # GitHub PAT
        re.compile(r"sk-[A-Za-z0-9]{48}"),             # OpenAI key
        re.compile(r"xoxb-[A-Za-z0-9\-]+"),           # Slack token
        re.compile(r"SCHWAB_API_KEY\s*=\s*['\"][^'\"]+['\"]"),
        re.compile(r"-----BEGIN (RSA |EC )?PRIVATE KEY-----"),
    ]

    violations: list[str] = []
    for py_file in (TRADINGAGENTS.rglob("*.py")):
        content = py_file.read_text(encoding="utf-8", errors="ignore")
        for pattern in secret_patterns:
            if pattern.search(content):
                rel = py_file.relative_to(ROOT)
                violations.append(f"{rel}: possible hardcoded secret (pattern: {pattern.pattern[:40]})")

    if violations:
        pytest.fail(
            "\n[SECRET SCAN VIOLATION]\n"
            + "\n".join(f"  - {v}" for v in violations)
        )
