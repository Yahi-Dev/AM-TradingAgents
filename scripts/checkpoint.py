#!/usr/bin/env python3
"""
Execution checkpoint manager for the autonomous development orchestrator.
Reads/writes execution state to allow safe interruption and resumption.

Usage:
  python scripts/checkpoint.py --init --story US-INFRA-0001
  python scripts/checkpoint.py --read
  python scripts/checkpoint.py --update --step 4 --status VALIDATING
  python scripts/checkpoint.py --complete --pr-url https://github.com/...
  python scripts/checkpoint.py --block --reason "3 fix attempts failed"
  python scripts/checkpoint.py --reset
"""
from __future__ import annotations

import argparse
import json
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).parent.parent
STATE_DIR = ROOT / ".orchestrator"
STATE_FILE = STATE_DIR / "execution-state.json"
SCHEMA_VERSION = "1.0"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def load_state() -> dict | None:
    if not STATE_FILE.exists():
        return None
    try:
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as e:
        print(f"[checkpoint] ERROR reading state: {e}", file=sys.stderr)
        return None


def save_state(state: dict) -> None:
    STATE_DIR.mkdir(exist_ok=True)
    state["updated_at"] = now_iso()
    STATE_FILE.write_text(json.dumps(state, indent=2), encoding="utf-8")
    print(f"[checkpoint] State saved: step={state.get('current_step')} status={state.get('lifecycle_status')}")


def new_state(story_id: str, github_issue: int | None = None) -> dict:
    return {
        "schema_version": SCHEMA_VERSION,
        "execution_id": str(uuid.uuid4()),
        "created_at": now_iso(),
        "updated_at": now_iso(),
        "active_story": story_id,
        "github_issue": github_issue,
        "branch": None,
        "base_commit": None,
        "current_commit": None,
        "current_step": 1,
        "last_completed_step": 0,
        "lifecycle_status": "PICKING_STORY",
        "files_changed": [],
        "checks_executed": [],
        "failures": [],
        "repair_attempt_count": 0,
        "max_repair_attempts": 3,
        "blocking_reason": None,
        "next_action": "implement",
        "pr_url": None,
        "pr_number": None,
        "model_used": "qwen3.8-27b",
        "implementation_start_time": None,
        "implementation_end_time": None,
        "tokens_used": None,
    }


def record_failure(state: dict, step: int, tool: str, summary: str, raw: str = "") -> dict:
    state["failures"].append({
        "attempt": state["repair_attempt_count"] + 1,
        "step": step,
        "tool": tool,
        "summary": summary,
        "raw_output": raw[:2000],
        "timestamp": now_iso(),
    })
    state["repair_attempt_count"] += 1
    return state


def main() -> None:
    parser = argparse.ArgumentParser(description="Orchestrator checkpoint manager")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--init",     action="store_true", help="Create new execution state")
    group.add_argument("--read",     action="store_true", help="Print current state as JSON")
    group.add_argument("--update",   action="store_true", help="Update fields in current state")
    group.add_argument("--fail",     action="store_true", help="Record a failure")
    group.add_argument("--complete", action="store_true", help="Mark story complete with PR")
    group.add_argument("--block",    action="store_true", help="Set BLOCKED_AUTOMATION")
    group.add_argument("--reset",    action="store_true", help="Delete current state (IDLE)")
    group.add_argument("--status-check", action="store_true", help="Exit 0 if not blocked, 1 if blocked")

    parser.add_argument("--story",     help="Story ID")
    parser.add_argument("--issue",     type=int, help="GitHub issue number")
    parser.add_argument("--step",      type=int, help="Step number (1-10)")
    parser.add_argument("--status",    help="Lifecycle status")
    parser.add_argument("--branch",    help="Git branch name")
    parser.add_argument("--commit",    help="Git commit SHA")
    parser.add_argument("--pr-url",    help="PR URL")
    parser.add_argument("--pr-number", type=int)
    parser.add_argument("--files",     nargs="*", help="Files changed")
    parser.add_argument("--tool",      help="Tool/check name (for --fail)")
    parser.add_argument("--summary",   help="Failure summary (for --fail)")
    parser.add_argument("--raw",       help="Raw failure output (for --fail)")
    parser.add_argument("--reason",    help="Blocking reason (for --block)")
    parser.add_argument("--tokens",    type=int, help="Tokens used")
    args = parser.parse_args()

    if args.init:
        if not args.story:
            print("--story required for --init", file=sys.stderr)
            sys.exit(1)
        state = new_state(args.story, args.issue)
        save_state(state)
        print(json.dumps({"execution_id": state["execution_id"], "story": state["active_story"]}))
        return

    if args.read:
        state = load_state()
        if not state:
            print(json.dumps({"lifecycle_status": "IDLE", "active_story": None}))
        else:
            print(json.dumps(state, indent=2))
        return

    if args.status_check:
        state = load_state()
        if state and state.get("lifecycle_status") == "BLOCKED_AUTOMATION":
            print(json.dumps({"blocked": True, "reason": state.get("blocking_reason")}))
            sys.exit(1)
        print(json.dumps({"blocked": False}))
        sys.exit(0)

    # All remaining actions require existing state
    state = load_state()
    if not state:
        print("[checkpoint] No active execution state. Run --init first.", file=sys.stderr)
        sys.exit(1)

    if args.update:
        if args.step is not None:
            state["last_completed_step"] = state["current_step"]
            state["current_step"] = args.step
        if args.status:
            state["lifecycle_status"] = args.status
        if args.branch:
            state["branch"] = args.branch
        if args.commit:
            state["current_commit"] = args.commit
        if args.files:
            state["files_changed"].extend(args.files)
        if args.tokens:
            state["tokens_used"] = (state.get("tokens_used") or 0) + args.tokens
        save_state(state)
        return

    if args.fail:
        if not args.tool or not args.summary:
            print("--tool and --summary required for --fail", file=sys.stderr)
            sys.exit(1)
        state = record_failure(state, args.step or state["current_step"], args.tool, args.summary, args.raw or "")
        if state["repair_attempt_count"] >= state["max_repair_attempts"]:
            state["lifecycle_status"] = "BLOCKED_AUTOMATION"
            state["blocking_reason"] = f"Max repair attempts ({state['max_repair_attempts']}) exceeded. Last failure: {args.summary}"
            print(f"[checkpoint] BLOCKED_AUTOMATION: {state['blocking_reason']}")
        save_state(state)
        print(json.dumps({"attempt": state["repair_attempt_count"], "blocked": state["lifecycle_status"] == "BLOCKED_AUTOMATION"}))
        return

    if args.complete:
        state["lifecycle_status"] = "DONE"
        state["pr_url"] = args.pr_url
        state["pr_number"] = args.pr_number
        state["current_step"] = 10
        state["last_completed_step"] = 10
        state["implementation_end_time"] = now_iso()
        save_state(state)
        print(json.dumps({"done": True, "story": state["active_story"], "pr_url": args.pr_url}))
        return

    if args.block:
        reason = args.reason or "Manual block"
        state["lifecycle_status"] = "BLOCKED_AUTOMATION"
        state["blocking_reason"] = reason
        save_state(state)
        print(json.dumps({"blocked": True, "reason": reason}))
        return

    if args.reset:
        if STATE_FILE.exists():
            STATE_FILE.unlink()
            print("[checkpoint] State reset. Orchestrator is IDLE.")
        else:
            print("[checkpoint] No active state to reset.")
        return


if __name__ == "__main__":
    main()
