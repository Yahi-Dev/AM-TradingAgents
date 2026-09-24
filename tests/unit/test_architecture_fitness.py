"""AC-03 — Architecture fitness function: prohibited imports are detected.

These tests exercise the same logic as ``scripts/check_architecture.py``
but in a unit-test context (no subprocess / no file-system scan of the
real repo — we build synthetic ASTs).
"""

from __future__ import annotations

import ast
from pathlib import Path
from typing import Final

import pytest

# Import the scan logic from the script module.
# We use importlib to load it because it lives under scripts/, not a package.
import importlib.util

_SCRIPT_PATH = Path(__file__).resolve().parent.parent.parent / "scripts" / "check_architecture.py"
_spec = importlib.util.spec_from_file_location("check_architecture", _SCRIPT_PATH)
assert _spec is not None
_mod = importlib.util.module_from_spec(_spec)  # type: ignore[assignment]
assert _spec.loader is not None
_spec.loader.exec_module(_mod)  # type: ignore[union-attr]

FORBIDDEN_IMPORTS: Final[dict[str, frozenset[str]]] = _mod.FORBIDDEN_IMPORTS
scan_package = _mod.scan_package
run_check = _mod.run_check
ArchitectureReport = _mod.ArchitectureReport


# ---------------------------------------------------------------------------
# Synthetic-AST helpers
# ---------------------------------------------------------------------------


def _make_tree(source: str) -> ast.AST:
    return ast.parse(source)


class TestAgentsImportLaw:
    """Ley 1: agents/ no importa execution/, oms/, broker/."""

    def test_agents_imports_execution_is_flagged(self) -> None:
        """A file under agents/ importing tradingagents.execution must be flagged."""
        # We create a temporary tree and verify the scan logic.
        source = "from tradingagents.execution import BrokerGateway\n"
        tree = _make_tree(source)
        imports = _mod._extract_imports(tree)
        flagged = [
            name
            for _, name in imports
            if name.startswith("tradingagents.execution")
        ]
        assert flagged, "Expected at least one flagged import"

    def test_agents_imports_oms_is_flagged(self) -> None:
        source = "import tradingagents.oms\n"
        tree = _make_tree(source)
        imports = _mod._extract_imports(tree)
        flagged = [
            name for _, name in imports if name.startswith("tradingagents.oms")
        ]
        assert flagged

    def test_agents_imports_broker_is_flagged(self) -> None:
        source = "from tradingagents.broker import SchwabBroker\n"
        tree = _make_tree(source)
        imports = _mod._extract_imports(tree)
        flagged = [
            name for _, name in imports if name.startswith("tradingagents.broker")
        ]
        assert flagged

    def test_agents_imports_risk_is_allowed(self) -> None:
        """Importing risk from agents is NOT a violation."""
        source = "from tradingagents.risk import RiskEngine\n"
        tree = _make_tree(source)
        imports = _mod._extract_imports(tree)
        forbidden = FORBIDDEN_IMPORTS["tradingagents.agents"]
        flagged = [
            name
            for _, name in imports
            if any(name == f or name.startswith(f + ".") for f in forbidden)
        ]
        assert not flagged


class TestRiskImportLaw:
    """Ley 4: risk/engine no importa ningún cliente LLM."""

    def test_risk_imports_openai_is_flagged(self) -> None:
        source = "import openai\n"
        tree = _make_tree(source)
        imports = _mod._extract_imports(tree)
        forbidden = FORBIDDEN_IMPORTS["tradingagents.risk"]
        flagged = [
            name
            for _, name in imports
            if any(name == f or name.startswith(f + ".") for f in forbidden)
        ]
        assert flagged

    def test_risk_imports_langchain_is_flagged(self) -> None:
        source = "from langchain import LLM\n"
        tree = _make_tree(source)
        imports = _mod._extract_imports(tree)
        forbidden = FORBIDDEN_IMPORTS["tradingagents.risk"]
        flagged = [
            name
            for _, name in imports
            if any(name == f or name.startswith(f + ".") for f in forbidden)
        ]
        assert flagged

    def test_risk_imports_pydantic_is_allowed(self) -> None:
        source = "from pydantic import BaseModel\n"
        tree = _make_tree(source)
        imports = _mod._extract_imports(tree)
        forbidden = FORBIDDEN_IMPORTS["tradingagents.risk"]
        flagged = [
            name
            for _, name in imports
            if any(name == f or name.startswith(f + ".") for f in forbidden)
        ]
        assert not flagged


class TestReport:
    """ArchitectureReport behaviour."""

    def test_empty_report_passes(self) -> None:
        report = ArchitectureReport()
        assert report.passed

    def test_report_with_violation_fails(self) -> None:
        report = ArchitectureReport()
        report.violations.append(
            _mod.Violation(
                file="tradingagents/agents/foo.py",
                line=1,
                imported_name="tradingagents.execution",
                source_package="tradingagents.agents",
                reason="forbidden import",
            )
        )
        assert not report.passed
        assert "FAILED" in str(report)

    def test_clean_report_str(self) -> None:
        report = ArchitectureReport()
        assert "PASSED" in str(report)