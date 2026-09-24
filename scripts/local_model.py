#!/usr/bin/env python3
"""
Interface to the local SLM (Qwen3.8-27B via llama-swap).
Sends implementation prompts and returns generated code.

Usage:
  python scripts/local_model.py --story US-INFRA-0001 --mode implement
  python scripts/local_model.py --prompt "fix this test" --mode fix
"""
import argparse
import json
import os
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

# Config — overridable via env
BASE_URL = os.getenv("LOCAL_SLM_URL", "http://127.0.0.1:8080/v1")
MODEL    = os.getenv("LOCAL_SLM_MODEL", "qwen3.8-27b")
TIMEOUT  = int(os.getenv("LOCAL_SLM_TIMEOUT", "480"))   # 8 min per request
MAX_TOKENS = int(os.getenv("LOCAL_SLM_MAX_TOKENS", "16384"))

ROOT = Path(__file__).parent.parent


def _post(messages: list[dict], temperature: float = 0.1) -> str:
    payload = json.dumps({
        "model": MODEL,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": MAX_TOKENS,
        "stream": False,
    }).encode()

    req = urllib.request.Request(
        f"{BASE_URL}/chat/completions",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            data = json.loads(resp.read().decode())
            msg = data["choices"][0]["message"]
            # Qwen3 thinking models may put output in reasoning_content when
            # content is empty. Prefer content; fall back to reasoning_content.
            content = msg.get("content") or msg.get("reasoning_content") or ""
            return content
    except urllib.error.URLError as e:
        print(f"[local_model] ERROR connecting to {BASE_URL}: {e}", file=sys.stderr)
        sys.exit(2)
    except (KeyError, json.JSONDecodeError) as e:
        print(f"[local_model] ERROR parsing response: {e}", file=sys.stderr)
        sys.exit(2)


def health_check() -> bool:
    try:
        req = urllib.request.Request(f"{BASE_URL}/models", method="GET")
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            models = [m["id"] for m in data.get("data", [])]
            print(f"[local_model] Available models: {models}")
            return True
    except Exception as e:
        print(f"[local_model] Health check failed: {e}", file=sys.stderr)
        return False


def load_story_contract(story_id: str) -> str:
    stories_file = ROOT / "docs" / "11-user-stories" / "initial-20-stories.md"
    if not stories_file.exists():
        return f"Story file not found: {stories_file}"
    content = stories_file.read_text(encoding="utf-8")
    # Extract the section for this story
    marker = f"### {story_id} —"
    start = content.find(marker)
    if start == -1:
        return f"Story {story_id} not found in catalog."
    # Find next story section or end of file
    next_story = content.find("\n### US-", start + 1)
    section = content[start:next_story] if next_story != -1 else content[start:]
    return section.strip()


def load_architecture_context() -> str:
    files = [
        "docs/02-architecture/target-architecture.md",
        "docs/03-domain/domain-model.md",
        "docs/12-adr/README.md",
    ]
    parts = []
    for f in files:
        p = ROOT / f
        if p.exists():
            text = p.read_text(encoding="utf-8")
            parts.append(f"=== {f} ===\n{text[:3000]}")  # cap per file
    return "\n\n".join(parts)


def build_implement_prompt(story_id: str, extra_context: str = "") -> list[dict]:
    story = load_story_contract(story_id)
    arch  = load_architecture_context()

    system = """/no_think
You are a senior Python engineer implementing user stories for AM-TradingAgents,
a professional agentic trading platform. Follow these rules absolutely:
1. Write production-quality Python 3.12+ code with full type hints.
2. Every function/class needs a short docstring if non-obvious.
3. Write pytest tests alongside the implementation.
4. Never import execution/, oms/, or broker/ from agents/ modules.
5. Never import LLM clients from risk/engine modules.
6. Use Pydantic v2 for data models.
7. Use SQLAlchemy 2 ORM syntax.
8. Output ONLY file blocks in this format:

FILE: path/to/file.py
```python
<code>
```

FILE: tests/unit/test_example.py
```python
<test code>
```

No explanations outside file blocks. No markdown prose. Only FILE blocks."""

    user = f"""Implement this user story completely:

{story}

Architecture context (respect these contracts):
{arch}

{f'Additional context:{extra_context}' if extra_context else ''}

Output all files needed to satisfy the Acceptance Criteria and Definition of Done.
Include the implementation files AND the test files."""

    return [
        {"role": "system", "content": system},
        {"role": "user",   "content": user},
    ]


def build_fix_prompt(error_output: str, story_id: str) -> list[dict]:
    story = load_story_contract(story_id)
    system = """You are fixing failing tests/lint errors in AM-TradingAgents.
Output ONLY corrected FILE blocks. Same format as before: FILE: path\n```python\n...\n```"""

    user = f"""Story being implemented: {story_id}

CI/validation output with errors:
{error_output}

Story context:
{story[:1500]}

Fix the errors. Output only the FILES that need to change."""

    return [
        {"role": "system", "content": system},
        {"role": "user",   "content": user},
    ]


def parse_and_write_files(output: str, dry_run: bool = False) -> list[str]:
    """Parse FILE: blocks from model output and write them to disk."""
    written = []
    lines = output.split("\n")
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if line.startswith("FILE:"):
            filepath = line[5:].strip()
            # Find opening code fence
            i += 1
            while i < len(lines) and not lines[i].strip().startswith("```"):
                i += 1
            i += 1  # skip fence line
            # Collect until closing fence
            code_lines = []
            while i < len(lines) and not lines[i].strip() == "```":
                code_lines.append(lines[i])
                i += 1
            code = "\n".join(code_lines)
            if filepath and code.strip():
                full_path = ROOT / filepath
                if not dry_run:
                    full_path.parent.mkdir(parents=True, exist_ok=True)
                    full_path.write_text(code, encoding="utf-8")
                    print(f"[local_model] WROTE: {filepath}")
                else:
                    print(f"[local_model] DRY-RUN would write: {filepath} ({len(code)} chars)")
                written.append(filepath)
        i += 1
    return written


def main():
    parser = argparse.ArgumentParser(description="AM-TradingAgents local SLM interface")
    parser.add_argument("--story",   help="Story ID (e.g. US-INFRA-0001)")
    parser.add_argument("--mode",    choices=["implement", "fix", "health"], default="implement")
    parser.add_argument("--prompt",  help="Raw prompt text (for --mode fix)")
    parser.add_argument("--dry-run", action="store_true", help="Parse output but don't write files")
    parser.add_argument("--output",  help="Save raw model output to this file")
    args = parser.parse_args()

    if args.mode == "health":
        ok = health_check()
        sys.exit(0 if ok else 1)

    if not health_check():
        print("[local_model] Local SLM not reachable. Check llama-swap.", file=sys.stderr)
        sys.exit(2)

    print(f"[local_model] Calling model={MODEL} mode={args.mode} story={args.story}")
    t0 = time.time()

    if args.mode == "implement":
        if not args.story:
            print("--story required for implement mode", file=sys.stderr)
            sys.exit(1)
        messages = build_implement_prompt(args.story)
    elif args.mode == "fix":
        prompt_text = args.prompt or sys.stdin.read()
        messages = build_fix_prompt(prompt_text, args.story or "unknown")

    output = _post(messages)
    elapsed = time.time() - t0
    print(f"[local_model] Response received in {elapsed:.1f}s ({len(output)} chars)")

    if args.output:
        Path(args.output).write_text(output, encoding="utf-8")
        print(f"[local_model] Raw output saved to {args.output}")

    written = parse_and_write_files(output, dry_run=args.dry_run)
    print(f"[local_model] Files written: {len(written)}")
    for f in written:
        print(f"  {f}")

    # Exit 0 only if files were written
    sys.exit(0 if written else 1)


if __name__ == "__main__":
    main()
