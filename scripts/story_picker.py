#!/usr/bin/env python3
"""
Picks the next story to implement from stories.yaml.
Returns JSON: {story_id, number, title, autonomy_risk}
or exits 1 if no story is available.

Prioritizes:
  1. Stories with status READY or DRAFT (if deps done)
  2. Only GREEN/BLUE risk (skip YELLOW/ORANGE/RED for autonomous execution)
  3. Dependencies must be DONE
  4. Topological order

Usage:
  python scripts/story_picker.py --json-out
  python scripts/story_picker.py --check US-AGENT-0002
"""
import json
import sys
import yaml
from pathlib import Path

ROOT = Path(__file__).parent.parent
STORIES_YAML = ROOT / "docs" / "control-plane" / "stories.yaml"

# Only these risk levels are safe for autonomous execution
AUTONOMOUS_RISKS = {"GREEN", "BLUE"}


def load_stories() -> dict[str, dict]:
    """Load stories from stories.yaml."""
    if not STORIES_YAML.exists():
        print(f"[story_picker] stories.yaml not found: {STORIES_YAML}", file=sys.stderr)
        sys.exit(2)
    with open(STORIES_YAML) as f:
        data = yaml.safe_load(f)
    return data.get("stories", {})

def find_next_story(stories: dict) -> dict | None:
    """Find next story to work on.
    Criteria:
    - Status is READY or (DRAFT + all dependencies DONE)
    - autonomy_risk is GREEN or BLUE only
    - All depends_on stories are DONE
    - Topological order
    """
    done_stories = {sid for sid, s in stories.items() if s.get("status") == "DONE"}

    for story_id in sorted(stories.keys()):  # Sort to maintain order
        story = stories[story_id]
        status = story.get("status", "DRAFT")

        # Skip terminal/blocked statuses
        if status in ("DONE", "BLOCKED_AUTOMATION"):
            continue

        # Skip RED (never autonomous)
        if story.get("autonomy_risk") == "RED":
            continue

        # Only GREEN/BLUE are safe for autonomous execution
        if story.get("autonomy_risk") not in AUTONOMOUS_RISKS:
            # Skip YELLOW/ORANGE — require explicit approval
            continue

        # Check dependencies
        deps = story.get("depends_on", [])
        if not all(d in done_stories for d in deps):
            continue  # Dependencies not satisfied

        # Found next story to work on
        return {
            "story_id": story_id,
            "title": story.get("title", ""),
            "number": story.get("github_issue", 0),
            "autonomy_risk": story.get("autonomy_risk", "UNKNOWN"),
            "status": status,
        }

    return None

def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--json-out", action="store_true", help="Output JSON")
    parser.add_argument("--check", metavar="STORY_ID", help="Check if specific story is ready")
    args = parser.parse_args()

    stories = load_stories()

    if args.check:
        story_id = args.check
        if story_id not in stories:
            print(json.dumps({"ready": False, "error": "Story not found"}))
            sys.exit(1)
        story = stories[story_id]
        deps = story.get("depends_on", [])
        done = {sid for sid, s in stories.items() if s.get("status") == "DONE"}
        blocked_by = [d for d in deps if d not in done]
        if blocked_by:
            print(json.dumps({"ready": False, "blocked_by": blocked_by}))
            sys.exit(1)
        print(json.dumps({"ready": True, "story_id": story_id}))
        sys.exit(0)

    next_story = find_next_story(stories)
    if not next_story:
        print(json.dumps({
            "story_id": None,
            "message": "No stories ready. All done, blocked, or require human approval."
        }))
        sys.exit(1)

    if args.json_out:
        print(json.dumps(next_story))
    else:
        print(f"NEXT: {next_story['story_id']} ({next_story['autonomy_risk']}) — {next_story['title']}")
        print(f"  Issue: #{next_story['number']}")

    sys.exit(0)


if __name__ == "__main__":
    main()
