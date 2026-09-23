#!/usr/bin/env python3
"""
Picks the next READY story from GitHub Issues.
Returns JSON: {story_id, issue_number, title, labels}
or exits 1 if no story is ready.

Usage:
  python scripts/story_picker.py
  python scripts/story_picker.py --status READY
"""
import json
import os
import subprocess
import sys

REPO = "orisonsoto/AM-TradingAgents"
TOKEN = os.getenv("GH_TOKEN", "")

# Topological order — must match dependency graph
STORY_ORDER = [
    "US-INFRA-0001", "US-INFRA-0002", "US-INFRA-0003",
    "US-SEC-0001",   "US-DATA-0001",
    "US-AGENT-0001", "US-AGENT-0002", "US-AGENT-0003", "US-AGENT-0004",
    "US-RISK-0001",  "US-RISK-0002",
    "US-OMS-0001",   "US-PORT-0001",  "US-AUDIT-0001",
    "US-API-0001",   "US-API-0002",
    "US-UI-0001",    "US-UI-0002",    "US-UI-0003",    "US-UI-0004",
]

# Which stories each story depends on
DEPENDS_ON = {
    "US-INFRA-0001": [],
    "US-INFRA-0002": ["US-INFRA-0001"],
    "US-INFRA-0003": ["US-INFRA-0001"],
    "US-SEC-0001":   ["US-INFRA-0002", "US-INFRA-0003"],
    "US-DATA-0001":  ["US-INFRA-0002"],
    "US-AGENT-0001": ["US-INFRA-0002", "US-INFRA-0003"],
    "US-AGENT-0002": ["US-AGENT-0001", "US-DATA-0001"],
    "US-AGENT-0003": ["US-AGENT-0002"],
    "US-AGENT-0004": ["US-AGENT-0003"],
    "US-RISK-0001":  ["US-AGENT-0004"],
    "US-RISK-0002":  ["US-RISK-0001"],
    "US-OMS-0001":   ["US-RISK-0001"],
    "US-PORT-0001":  ["US-OMS-0001"],
    "US-AUDIT-0001": ["US-AGENT-0004", "US-RISK-0001", "US-OMS-0001"],
    "US-API-0001":   ["US-AGENT-0004", "US-RISK-0001"],
    "US-API-0002":   ["US-API-0001"],
    "US-UI-0001":    ["US-INFRA-0003"],
    "US-UI-0002":    ["US-UI-0001", "US-PORT-0001"],
    "US-UI-0003":    ["US-UI-0001", "US-API-0002"],
    "US-UI-0004":    ["US-UI-0001", "US-SEC-0001"],
}


def gh(args: list[str]) -> dict | list:
    env = os.environ.copy()
    cmd = ["gh"] + args
    result = subprocess.run(cmd, capture_output=True, text=True, env=env)
    if result.returncode != 0:
        print(f"[story_picker] gh error: {result.stderr}", file=sys.stderr)
        sys.exit(1)
    return json.loads(result.stdout)


def get_all_issues() -> dict[str, dict]:
    """Returns {story_id: issue_data} for all story issues."""
    issues = gh([
        "issue", "list", "--repo", REPO,
        "--label", "story",
        "--state", "open",
        "--json", "number,title,labels,body",
        "--limit", "50",
    ])
    result = {}
    for issue in issues:
        title = issue["title"]
        # Extract story ID from title like "[US-INFRA-0001] ..."
        if title.startswith("[") and "]" in title:
            story_id = title[1:title.index("]")]
            result[story_id] = issue
    return result


def get_done_stories() -> set[str]:
    """Stories with closed issues = DONE."""
    closed = gh([
        "issue", "list", "--repo", REPO,
        "--label", "story",
        "--state", "closed",
        "--json", "title",
        "--limit", "100",
    ])
    done = set()
    for issue in closed:
        title = issue["title"]
        if title.startswith("[") and "]" in title:
            story_id = title[1:title.index("]")]
            done.add(story_id)
    return done


def find_next_ready(done: set[str], open_issues: dict) -> dict | None:
    """Find first story in topological order whose dependencies are all done."""
    for story_id in STORY_ORDER:
        if story_id in done:
            continue  # already done
        if story_id not in open_issues:
            continue  # no issue created yet
        deps = DEPENDS_ON.get(story_id, [])
        if all(d in done for d in deps):
            return {"story_id": story_id, **open_issues[story_id]}
    return None


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--json-out", action="store_true", help="Output JSON")
    parser.add_argument("--check", metavar="STORY_ID", help="Check if specific story is ready")
    args = parser.parse_args()

    done    = get_done_stories()
    open_is = get_all_issues()

    if args.check:
        story_id = args.check
        deps = DEPENDS_ON.get(story_id, [])
        blocked_by = [d for d in deps if d not in done]
        if blocked_by:
            print(json.dumps({"ready": False, "blocked_by": blocked_by}))
            sys.exit(1)
        else:
            print(json.dumps({"ready": True, "story_id": story_id}))
            sys.exit(0)

    next_story = find_next_ready(done, open_is)
    if not next_story:
        print(json.dumps({"story_id": None, "message": "No READY stories found. All done or blocked."}))
        sys.exit(1)

    if args.json_out:
        print(json.dumps(next_story))
    else:
        print(f"NEXT: {next_story['story_id']} — {next_story['title']}")
        print(f"  Issue: #{next_story['number']}")
        labels = [l['name'] for l in next_story.get('labels', [])]
        print(f"  Labels: {labels}")

    sys.exit(0)


if __name__ == "__main__":
    main()
