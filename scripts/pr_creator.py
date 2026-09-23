#!/usr/bin/env python3
"""
Creates a GitHub PR for a completed story implementation.
  - Creates branch if needed
  - Stages and commits all changed files
  - Pushes to origin
  - Opens PR linked to the story issue
  - Closes the issue on merge

Usage:
  python scripts/pr_creator.py --story US-INFRA-0001 --issue 2 --files file1.py file2.py
"""
import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
REPO = "orisonsoto/AM-TradingAgents"


def run(cmd: list[str], check=True) -> subprocess.CompletedProcess:
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=ROOT)
    if check and result.returncode != 0:
        print(f"[pr_creator] ERROR: {' '.join(cmd)}", file=sys.stderr)
        print(result.stderr, file=sys.stderr)
        sys.exit(1)
    return result


def story_to_branch(story_id: str, title: str) -> str:
    slug = title.lower()
    for ch in " ()→+&/\\,":
        slug = slug.replace(ch, "-")
    slug = "-".join(p for p in slug.split("-") if p)[:40]
    return f"feature/{story_id}-{slug}"


def get_changed_files() -> list[str]:
    result = run(["git", "status", "--porcelain"])
    files = []
    for line in result.stdout.splitlines():
        if line.strip():
            files.append(line[3:].strip())
    return files


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--story",   required=True, help="Story ID e.g. US-INFRA-0001")
    parser.add_argument("--issue",   required=True, type=int, help="GitHub issue number")
    parser.add_argument("--title",   required=True, help="Story short title for branch/PR")
    parser.add_argument("--files",   nargs="*",     help="Specific files to stage (default: all changed)")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    branch = story_to_branch(args.story, args.title)
    print(f"[pr_creator] Branch: {branch}")

    # Create and switch to branch
    if not args.dry_run:
        run(["git", "checkout", "-b", branch])

    # Stage files
    files_to_stage = args.files or get_changed_files()
    if not files_to_stage:
        print("[pr_creator] No files to commit.", file=sys.stderr)
        sys.exit(1)
    print(f"[pr_creator] Staging {len(files_to_stage)} files")
    if not args.dry_run:
        run(["git", "add"] + files_to_stage)

    # Commit
    commit_msg = f"""feat({args.story.lower()}): {args.title}

Implements {args.story} per docs/11-user-stories/initial-20-stories.md

Closes #{args.issue}

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"""

    if not args.dry_run:
        result = subprocess.run(
            ["git", "commit", "-m", commit_msg],
            capture_output=True, text=True, cwd=ROOT
        )
        if result.returncode != 0:
            print(f"[pr_creator] Commit failed: {result.stderr}", file=sys.stderr)
            sys.exit(1)
        print(f"[pr_creator] Committed: {result.stdout.strip()}")

    # Push
    if not args.dry_run:
        run(["git", "push", "-u", "origin", branch])
        print(f"[pr_creator] Pushed branch: {branch}")

    # Count stats
    diff_result = run(["git", "diff", "HEAD~1", "--stat"], check=False)
    stats = diff_result.stdout[:500] if diff_result.returncode == 0 else ""

    # Create PR
    pr_body = f"""## Story
**{args.story}** — {args.title}

Closes #{args.issue}

## Changes
{stats}

## Acceptance Criteria
See full spec: `docs/11-user-stories/initial-20-stories.md`

## Checklist
- [ ] Implementation complete
- [ ] Unit tests pass
- [ ] Architecture fitness functions pass (no forbidden imports)
- [ ] mypy type-check passes
- [ ] ruff lint passes
- [ ] Documentation updated

## Traceability
- Story: `{args.story}`
- Issue: #{args.issue}
- Epic: see issue labels
- Docs: `docs/11-user-stories/initial-20-stories.md`

---
🤖 Generated with [Claude Code](https://claude.com/claude-code)"""

    if not args.dry_run:
        result = subprocess.run([
            "gh", "pr", "create",
            "--repo", REPO,
            "--base", "main",
            "--head", branch,
            "--title", f"[{args.story}] {args.title}",
            "--body", pr_body,
        ], capture_output=True, text=True, cwd=ROOT)
        if result.returncode != 0:
            print(f"[pr_creator] PR creation failed: {result.stderr}", file=sys.stderr)
            sys.exit(1)
        pr_url = result.stdout.strip()
        print(f"[pr_creator] PR created: {pr_url}")
        print(json.dumps({"pr_url": pr_url, "branch": branch, "story": args.story}))
    else:
        print(f"[pr_creator] DRY-RUN — would create PR for {branch}")
        print(json.dumps({"dry_run": True, "branch": branch, "story": args.story}))

    sys.exit(0)


if __name__ == "__main__":
    main()
