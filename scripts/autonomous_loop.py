#!/usr/bin/env python3
"""
Fully autonomous development loop.
Runs continuously without stopping, handling all errors automatically.
No user interaction required. Designed to run overnight.

Uses local SLM for implementation, Claude for orchestration/validation.
"""
import subprocess
import json
import sys
import time
import yaml
from pathlib import Path

ROOT = Path(__file__).parent.parent
REPO = "orisonsoto/AM-TradingAgents"
STORIES_YAML = ROOT / "docs" / "control-plane" / "stories.yaml"

def run(cmd, check=True, timeout=600):
    """Execute command with auto-retry on timeout."""
    retries = 0
    while retries < 2:
        try:
            result = subprocess.run(
                cmd, capture_output=True, text=True, timeout=timeout, cwd=ROOT
            )
            if check and result.returncode != 0:
                if retries < 1:
                    print(f"[WARN] Command failed, retrying...")
                    retries += 1
                    time.sleep(5)
                    continue
            return result
        except subprocess.TimeoutExpired:
            if retries < 1:
                print(f"[TIMEOUT] Retrying...")
                retries += 1
                time.sleep(10)
            else:
                return None
    return result

def health_check():
    """Verify local SLM is reachable."""
    result = run(["python", "scripts/local_model.py", "--mode", "health"], check=False)
    return result and result.returncode == 0

def pick_story():
    """Get next READY story (skip DONE)."""
    result = run(
        ["python", "scripts/story_picker.py", "--json-out"],
        check=False, timeout=10
    )
    if result and result.returncode == 0:
        try:
            return json.loads(result.stdout)
        except:
            return None
    return None

def implement_story(story_id):
    """Delegate implementation to local SLM."""
    print(f"[IMPL] Implementing {story_id}...")
    result = run(
        ["python", "scripts/local_model.py", "--story", story_id, "--mode", "implement"],
        check=False, timeout=600
    )
    return result and result.returncode == 0

def validate_story(story_id, attempt=1):
    """Run CI validation with auto-retry and ruff --fix."""
    print(f"  [VALIDATE] Attempt {attempt}/3...")
    result = run(
        ["python", "scripts/validate_story.py", "--story", story_id],
        check=False, timeout=120
    )
    if result and result.returncode == 0:
        return True
    if attempt < 3:
        print(f"  [FIX] Running fix loop...")
        result = run(
            ["python", "scripts/local_model.py", "--story", story_id, "--mode", "fix",
             "--prompt", result.stderr if result else ""],
            check=False, timeout=600
        )
        if result and result.returncode == 0:
            return validate_story(story_id, attempt + 1)
    return False

def create_pr(story_id, issue):
    """Create and push PR."""
    title = story_id.lower().replace("-", " ").title()
    result = run(
        ["python", "scripts/pr_creator.py",
         "--story", story_id, "--issue", str(issue), "--title", title],
        check=False, timeout=60
    )
    return result and result.returncode == 0

def close_issue(issue):
    """Close GitHub issue."""
    run(
        ["gh", "issue", "close", str(issue), "--repo", REPO],
        check=False, timeout=10
    )

def mark_story_blocked(story_id):
    """Update stories.yaml to mark story as BLOCKED_AUTOMATION."""
    try:
        with open(STORIES_YAML, encoding='utf-8') as f:
            data = yaml.safe_load(f)

        if story_id in data.get("stories", {}):
            data["stories"][story_id]["status"] = "BLOCKED_AUTOMATION"

            with open(STORIES_YAML, 'w', encoding='utf-8') as f:
                yaml.dump(data, f, default_flow_style=False, sort_keys=False, allow_unicode=True)
            print(f"[BLOCKED] Updated stories.yaml: {story_id} -> BLOCKED_AUTOMATION")
    except Exception as e:
        print(f"[WARN] Could not update stories.yaml: {e}", file=sys.stderr)

def main():
    print("[LOOP] Autonomous Development Loop Started")
    print("       Continuous execution, auto-skip failures.")
    print()

    stories_done = 0
    blocked_stories = set()

    while True:
        # Pick next story (only READY, not DONE)
        story_data = pick_story()
        if not story_data:
            print()
            print("[DONE] All stories processed.")
            break

        story_id = story_data.get("story_id")
        issue = story_data.get("number")

        if not story_id or not issue:
            print("[SKIP] Invalid story data")
            time.sleep(5)
            continue

        # Skip if already blocked
        if story_id in blocked_stories:
            print(f"[SKIP] {story_id} already blocked, moving on")
            close_issue(issue)
            continue

        print(f"[STORY] [{stories_done+1}/20] {story_id} (Issue #{issue})")

        # Implement
        if not implement_story(story_id):
            print(f"  [BLOCKED] Implementation failed")
            blocked_stories.add(story_id)
            mark_story_blocked(story_id)
            close_issue(issue)
            continue

        # Validate with retries (auto-fix included)
        if not validate_story(story_id):
            print(f"  [BLOCKED] Validation failed 3x")
            blocked_stories.add(story_id)
            mark_story_blocked(story_id)
            close_issue(issue)
            continue

        # Create PR
        if create_pr(story_id, issue):
            print(f"  [SUCCESS] PR created")
            close_issue(issue)
            stories_done += 1
        else:
            print(f"  [BLOCKED] PR creation failed")
            blocked_stories.add(story_id)
            mark_story_blocked(story_id)
            close_issue(issue)

        time.sleep(2)

    print(f"[REPORT] Completed: {stories_done} stories, Blocked: {len(blocked_stories)}")
    return 0 if len(blocked_stories) == 0 else 1

if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n[STOP] Interrupted by user")
        sys.exit(0)
    except Exception as e:
        print(f"[ERROR] {e}")
        import traceback
        traceback.print_exc()
        sys.exit(2)
