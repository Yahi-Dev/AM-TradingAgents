"""Architecture fitness function — verifies import-layering laws.

Laws enforced:
  1. ``tradingagents/agents/`` must NOT import ``tradingagents.execution``,
     ``tradingagents.oms``, or ``tradingagents.broker``.
  2. ``tradingagents/risk/`` must NOT import any LLM client
     (``openai``, ``anthropic``, ``llm``, ``langchain``, ``langgraph``).

Exit code 0 = pass, 1 = violation detected.
"""

from __future__ import annotations

import sys
from pathlib import Path

import ast
from dataclasses import dataclass, field
from typing import Final

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

#: Mapping of source-package prefix -> set of forbidden import prefixes.
FORBIDDEN_IMPORTS: Final[dict[str, frozenset[str]]] = {
    "tradingagents.agents": frozenset(
        {
            "tradingagents.execution",
            "tradingagents.oms",
            "tradingagents.broker",
        }
    ),
    "tradingagents.risk": frozenset(
        {
            "openai",
            "anthropic",
            "llm",
            "langchain",
            "langgraph",
        }
    ),
}


@dataclass
class Violation:
    """A single architecture violation record."""

    file: str
    line: int
    imported_name: str
    source_package: str
    reason: str


@dataclass
class ArchitectureReport:
    """Aggregated result of the architecture scan."""

    violations: list[Violation] = field(default_factory=list)

    @property
    def passed(self) -> bool:
        return len(self.violations) == 0

    def __str__(self) -> str:
        if self.passed:
            return "Architecture check PASSED: no violations."
        lines = ["Architecture check FAILED:"]
        for v in self.violations:
            lines.append(
                f"  {v.file}:{v.line} — imports '{v.imported_name}' "
                f"from '{v.source_package}' ({v.reason})"
            )
        return "\n".join(lines)


def _extract_imports(tree: ast.AST) -> list[tuple[int, str]]:
    """Yield (lineno, module_name) for every import in the tree."""
    results: list[tuple[int, str]] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                results.append((node.lineno, alias.name))
        elif isinstance(node, ast.ImportFrom):
            module = node.module or ""
            for alias in node.names:
                results.append((node.lineno, f"{module}.{alias.name}"))
            results.append((node.lineno, module))
    return results


def _file_belongs_to(file: Path, package_prefix: str) -> bool:
    """Check whether *file* is under the given package directory."""
    parts = file.parts
    prefix_parts = package_prefix.split(".")
    return parts[: len(prefix_parts)] == prefix_parts


def scan_package(
    root: Path,
    source_prefix: str,
    forbidden: frozenset[str],
) -> list[Violation]:
    """Scan all .py files under *source_prefix* for forbidden imports."""
    violations: list[Violation] = []
    source_dir = root / source_prefix.replace(".", "/")
    if not source_dir.is_dir():
        return violations

    for py_file in sorted(source_dir.rglob("*.py")):
        try:
            source = py_file.read_text(encoding="utf-8")
            tree = ast.parse(source)
        except SyntaxError:
            continue

        for lineno, name in _extract_imports(tree):
            for forbidden_prefix in forbidden:
                if name == forbidden_prefix or name.startswith(forbidden_prefix + "."):
                    violations.append(
                        Violation(
                            file=str(py_file),
                            line=lineno,
                            imported_name=name,
                            source_package=source_prefix,
                            reason=f"forbidden import from '{source_prefix}'",
                        )
                    )
    return violations


def run_check(root: Path) -> ArchitectureReport:
    """Execute all architecture laws and return a report."""
    report = ArchitectureReport()
    for source_prefix, forbidden in FORBIDDEN_IMPORTS.items():
        report.violations.extend(scan_package(root, source_prefix, forbidden))
    return report


def main() -> int:
    """CLI entry-point. Returns 0 on pass, 1 on violation."""
    root = Path(__file__).resolve().parent.parent
    report = run_check(root)
    print(report)
    return 0 if report.passed else 1


if __name__ == "__main__":
    sys.exit(main())