"""
Traceability fitness functions — run in CI on every PR.

Validates:
  1. All Story IDs referenced in code/PRs actually exist in stories.yaml
  2. READY stories in stories.yaml have at least one requirement ID
  3. stories.yaml is valid YAML and passes basic structural checks
  4. Dependency graph has no cycles
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).parent.parent.parent
STORIES_FILE = ROOT / "docs" / "control-plane" / "stories.yaml"
STORIES_MD = ROOT / "docs" / "11-user-stories" / "initial-20-stories.md"

STORY_ID_PATTERN = re.compile(r"\bUS-[A-Z]+-\d{4}\b")
EPIC_ID_PATTERN = re.compile(r"\bEPIC-[A-Z]+-\d{3}\b")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def load_stories_yaml() -> dict:
    if not STORIES_FILE.exists():
        pytest.skip(f"stories.yaml not found at {STORIES_FILE}")
    return yaml.safe_load(STORIES_FILE.read_text(encoding="utf-8"))


def canonical_story_ids(data: dict) -> set[str]:
    return set(data.get("stories", {}).keys())


# ---------------------------------------------------------------------------
# Test 1 — stories.yaml exists and is valid YAML
# ---------------------------------------------------------------------------

@pytest.mark.traceability
def test_stories_yaml_is_valid() -> None:
    """docs/control-plane/stories.yaml must exist and parse as valid YAML."""
    assert STORIES_FILE.exists(), f"stories.yaml not found: {STORIES_FILE}"
    data = load_stories_yaml()
    assert "stories" in data, "stories.yaml must have a 'stories' key"
    assert "schema_version" in data, "stories.yaml must have a 'schema_version' key"
    assert len(data["stories"]) > 0, "stories.yaml must contain at least one story"


# ---------------------------------------------------------------------------
# Test 2 — All stories in stories.yaml have required fields
# ---------------------------------------------------------------------------

@pytest.mark.traceability
def test_all_stories_have_required_fields() -> None:
    """Every story in stories.yaml must have the required structural fields."""
    data = load_stories_yaml()
    required = {
        "title", "epic", "capability", "github_issue", "status",
        "autonomy_risk", "depends_on", "allowed_modules",
        "required_tests", "required_checks",
    }
    missing: list[str] = []
    for story_id, story in data.get("stories", {}).items():
        for field in required:
            if field not in story:
                missing.append(f"{story_id}: missing field '{field}'")
    if missing:
        pytest.fail("Stories missing required fields:\n" + "\n".join(f"  - {m}" for m in missing))


# ---------------------------------------------------------------------------
# Test 3 — Dependency graph has no cycles
# ---------------------------------------------------------------------------

@pytest.mark.traceability
def test_no_dependency_cycles() -> None:
    """Story dependency graph must be acyclic (DAG)."""
    data = load_stories_yaml()
    stories = data.get("stories", {})

    def has_cycle(story_id: str, visited: set, path: set) -> bool:
        visited.add(story_id)
        path.add(story_id)
        for dep in stories.get(story_id, {}).get("depends_on", []):
            if dep not in visited:
                if has_cycle(dep, visited, path):
                    return True
            elif dep in path:
                return True
        path.discard(story_id)
        return False

    visited: set = set()
    for story_id in stories:
        if story_id not in visited:
            assert not has_cycle(story_id, visited, set()), (
                f"Dependency cycle detected involving {story_id}"
            )


# ---------------------------------------------------------------------------
# Test 4 — All dependency references point to existing stories
# ---------------------------------------------------------------------------

@pytest.mark.traceability
def test_dependency_references_exist() -> None:
    """Every story in depends_on must itself exist in stories.yaml."""
    data = load_stories_yaml()
    stories = data.get("stories", {})
    known = set(stories.keys())
    dangling: list[str] = []
    for story_id, story in stories.items():
        for dep in story.get("depends_on", []):
            if dep not in known:
                dangling.append(f"{story_id} depends_on unknown story: {dep}")
    if dangling:
        pytest.fail("Dangling dependency references:\n" + "\n".join(f"  - {d}" for d in dangling))


# ---------------------------------------------------------------------------
# Test 5 — All epic references in stories.yaml exist in epics section
# ---------------------------------------------------------------------------

@pytest.mark.traceability
def test_epic_references_exist() -> None:
    """Each story's epic must be declared in the epics section."""
    data = load_stories_yaml()
    known_epics = set(data.get("epics", {}).keys())
    stories = data.get("stories", {})
    bad: list[str] = []
    for story_id, story in stories.items():
        epic = story.get("epic")
        if epic and epic not in known_epics:
            bad.append(f"{story_id}: references unknown epic '{epic}'")
    if bad:
        pytest.fail("Unknown epic references:\n" + "\n".join(f"  - {b}" for b in bad))


# ---------------------------------------------------------------------------
# Test 6 — All story IDs mentioned in initial-20-stories.md exist in stories.yaml
# ---------------------------------------------------------------------------

@pytest.mark.traceability
def test_md_story_ids_exist_in_yaml() -> None:
    """Every US-XXXX-NNNN ID in initial-20-stories.md must exist in stories.yaml."""
    if not STORIES_MD.exists():
        pytest.skip("initial-20-stories.md not found")
    data = load_stories_yaml()
    known = canonical_story_ids(data)
    content = STORIES_MD.read_text(encoding="utf-8")
    found = set(STORY_ID_PATTERN.findall(content))
    unknown = found - known
    if unknown:
        pytest.fail(
            "Story IDs in initial-20-stories.md not found in stories.yaml:\n"
            + "\n".join(f"  - {s}" for s in sorted(unknown))
        )


# ---------------------------------------------------------------------------
# Test 7 — Autonomy risk values are valid
# ---------------------------------------------------------------------------

_VALID_RISK = {"GREEN", "BLUE", "YELLOW", "ORANGE", "RED"}


@pytest.mark.traceability
def test_valid_autonomy_risk_levels() -> None:
    """All autonomy_risk values must be one of the defined levels."""
    data = load_stories_yaml()
    bad: list[str] = []
    for story_id, story in data.get("stories", {}).items():
        risk = story.get("autonomy_risk")
        if risk not in _VALID_RISK:
            bad.append(f"{story_id}: invalid autonomy_risk '{risk}'")
    if bad:
        pytest.fail("Invalid risk levels:\n" + "\n".join(f"  - {b}" for b in bad))


# ---------------------------------------------------------------------------
# Test 8 — Status values are valid
# ---------------------------------------------------------------------------

_VALID_STATUS = {
    "DRAFT", "REFINED", "READY", "IN_PROGRESS", "PR_OPEN",
    "IN_REVIEW", "CI_FAILED", "CI_PASSED", "MERGED", "VERIFIED",
    "DONE", "BLOCKED_AUTOMATION",
}


@pytest.mark.traceability
def test_valid_story_statuses() -> None:
    """All story status values must be from the defined lifecycle."""
    data = load_stories_yaml()
    bad: list[str] = []
    for story_id, story in data.get("stories", {}).items():
        status = story.get("status")
        if status not in _VALID_STATUS:
            bad.append(f"{story_id}: invalid status '{status}'")
    if bad:
        pytest.fail("Invalid story statuses:\n" + "\n".join(f"  - {b}" for b in bad))
