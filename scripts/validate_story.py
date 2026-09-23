#!/usr/bin/env python3
"""
Validates a story implementation:
  1. ruff lint
  2. mypy type-check
  3. pytest (unit tests for the story)
  4. architecture fitness functions (import rules)

Usage:
  python scripts/validate_story.py --story US-INFRA-0001
  python scripts/validate_story.py --story US-RISK-0001 --fix-hints

Exit codes:
  0 = all passed
  1 = one or more checks failed (prints summary to stdout as JSON)
  2 = internal error
"""
import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent

# Forbidden imports: {module_prefix: [must_not_import]}
ARCHITECTURE_RULES = {
    "tradingagents/agents":    ["tradingagents.execution", "tradingagents.oms",
                                "tradingagents.broker", "schwab"],
    "tradingagents/risk/engine": ["tradingagents.llm_clients", "langchain",
                                  "openai", "anthropic"],
}


def run(cmd: list[str], cwd=ROOT) -> tuple[int, str, str]:
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=cwd)
    return result.returncode, result.stdout, result.stderr


def check_ruff() -> dict:
    code, out, err = run(["python", "-m", "ruff", "check", "tradingagents/", "apps/", "--output-format=json"])
    if code == 0:
        return {"passed": True, "tool": "ruff"}
    try:
        issues = json.loads(out)
        return {"passed": False, "tool": "ruff", "issues": issues[:20], "raw": out[:2000]}
    except json.JSONDecodeError:
        return {"passed": False, "tool": "ruff", "raw": (out + err)[:2000]}


def check_mypy() -> dict:
    code, out, err = run(["python", "-m", "mypy", "tradingagents/", "apps/",
                          "--ignore-missing-imports", "--no-error-summary"])
    if code == 0:
        return {"passed": True, "tool": "mypy"}
    return {"passed": False, "tool": "mypy", "raw": out[:3000]}


def check_pytest(story_id: str) -> dict:
    # Run tests related to the story
    story_slug = story_id.lower().replace("-", "_").replace("us_", "")
    test_patterns = [
        f"tests/unit/test_{story_slug}",
        f"tests/unit/test_{story_id.lower().replace('-','_')}",
        f"tests/",  # fallback: all tests
    ]
    for pattern in test_patterns:
        test_path = ROOT / pattern if not pattern.endswith("/") else ROOT / pattern
        if test_path.exists() or pattern.endswith("/"):
            code, out, err = run([
                "python", "-m", "pytest", str(test_path),
                "-x", "--tb=short", "-q",
                f"--timeout=60",
            ])
            if code == 0:
                return {"passed": True, "tool": "pytest", "pattern": pattern}
            return {"passed": False, "tool": "pytest", "pattern": pattern, "raw": out[-3000:]}
    return {"passed": True, "tool": "pytest", "note": "No tests found yet — skipped"}


def check_architecture() -> dict:
    violations = []
    for module_path, forbidden in ARCHITECTURE_RULES.items():
        source_dir = ROOT / module_path
        if not source_dir.exists():
            continue
        py_files = list(source_dir.rglob("*.py")) if source_dir.is_dir() else [source_dir]
        for py_file in py_files:
            content = py_file.read_text(encoding="utf-8", errors="ignore")
            for banned in forbidden:
                if f"import {banned}" in content or f"from {banned}" in content:
                    violations.append({
                        "file": str(py_file.relative_to(ROOT)),
                        "banned_import": banned,
                        "rule": f"{module_path} must not import {banned}",
                    })
    if violations:
        return {"passed": False, "tool": "architecture", "violations": violations}
    return {"passed": True, "tool": "architecture"}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--story", required=True)
    parser.add_argument("--skip-tests", action="store_true")
    parser.add_argument("--fix-hints", action="store_true",
                        help="Include suggestions for fixes in output")
    args = parser.parse_args()

    print(f"[validate] Story: {args.story}")
    results = []

    print("[validate] Running: ruff...")
    results.append(check_ruff())

    print("[validate] Running: mypy...")
    results.append(check_mypy())

    if not args.skip_tests:
        print(f"[validate] Running: pytest for {args.story}...")
        results.append(check_pytest(args.story))

    print("[validate] Running: architecture fitness functions...")
    results.append(check_architecture())

    failed = [r for r in results if not r["passed"]]
    passed = [r for r in results if r["passed"]]

    summary = {
        "story_id": args.story,
        "all_passed": len(failed) == 0,
        "passed": [r["tool"] for r in passed],
        "failed": failed,
    }

    print(json.dumps(summary, indent=2))

    if failed:
        # Print human-readable summary for Claude to act on
        print("\n=== FAILURE SUMMARY ===")
        for f in failed:
            print(f"\n[{f['tool'].upper()}] FAILED")
            if "raw" in f:
                print(f["raw"][:1500])
            if "violations" in f:
                for v in f["violations"]:
                    print(f"  ARCHITECTURE VIOLATION: {v['file']} imports {v['banned_import']}")
                    print(f"  Rule: {v['rule']}")
        sys.exit(1)

    print("\n✓ All checks passed.")
    sys.exit(0)


if __name__ == "__main__":
    main()
