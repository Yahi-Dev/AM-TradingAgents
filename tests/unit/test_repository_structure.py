"""AC-01 — Verify the target repository directory structure exists."""

from __future__ import annotations

from pathlib import Path

import pytest

REPO_ROOT: Path = Path(__file__).resolve().parent.parent.parent

REQUIRED_DIRECTORIES: list[str] = [
    "tradingagents/risk",
    "tradingagents/oms",
    "tradingagents/execution",
    "tradingagents/events",
    "tradingagents/portfolio",
    "tradingagents/learning",
    "apps/api",
    "apps/web",
    "docs",
    "migrations",
    "tests",
]


@pytest.mark.parametrize("rel_path", REQUIRED_DIRECTORIES)
def test_directory_exists(rel_path: str) -> None:
    """Each required directory must exist in the repository."""
    target = REPO_ROOT / rel_path
    assert target.is_dir(), f"Missing directory: {rel_path}"


def test_all_required_directories_present() -> None:
    """Aggregate check — all directories in one assertion for clarity."""
    missing = [
        rel for rel in REQUIRED_DIRECTORIES if not (REPO_ROOT / rel).is_dir()
    ]
    assert not missing, f"Missing directories: {missing}"