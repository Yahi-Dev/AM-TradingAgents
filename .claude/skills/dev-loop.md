# Skill: dev-loop — Autonomous Development Loop

Autonomous story-by-story development loop for AM-TradingAgents.
Invoked with `/dev-loop` or `Skill("dev-loop")`.

---

## Your role in this loop

You are the **Orchestrator**. You control the loop end-to-end:
- Pick the next story
- Build the context packet
- Delegate implementation to the local SLM
- Validate the result
- Commit, push, create PR
- Update GitHub
- Loop to the next story

The **local SLM** (Qwen3.8-27B at `http://127.0.0.1:8080/v1`) is the Implementer.
It writes all code and tests. You never write implementation code yourself — you orchestrate.

---

## Model selection rules (STRICT)

| Task | Model |
|---|---|
| Story implementation (code + tests) | **Local Qwen3.8-27B** via `scripts/local_model.py` |
| Fix loop (retry after CI failure) | **Local Qwen3.8-27B** via `scripts/local_model.py --mode fix` |
| Architecture validation judgment | **You (Claude Sonnet)** |
| PR description & story selection | **You (Claude Sonnet)** |
| Minor lint suggestions | **You (Claude Haiku if available)** |

Never write story implementation code yourself. Always delegate to the local model.

---

## Loop protocol — execute this exactly

### STEP 1 — Health check
```bash
python scripts/local_model.py --mode health
```
If exit code != 0: stop loop, report "Local SLM not reachable at http://127.0.0.1:8080/v1".

### STEP 2 — Pick next story
```bash
python scripts/story_picker.py --json-out
```
- If exit code 1 / story_id is null: **all stories done or blocked** — report summary and stop.
- Extract `story_id` and `number` (issue number) from JSON output.

### STEP 3 — Announce story
Report to user: `🚀 Starting [story_id] — [title] (Issue #N)`

### STEP 4 — Read story contract
Read the full story from `docs/11-user-stories/initial-20-stories.md`.
Find the section starting with `### {story_id}`.
Understand the Acceptance Criteria and Definition of Done.

### STEP 5 — Delegate to local model
```bash
python scripts/local_model.py --story {story_id} --mode implement --output /tmp/impl_{story_id}.txt
```
- This call can take 2–10 minutes (27B model on 12GB GPU). Wait patiently.
- If exit code != 0: retry once. If still fails, skip story and report.
- The script writes files directly to the repo.

### STEP 6 — Validate implementation
```bash
python scripts/validate_story.py --story {story_id}
```
Parse JSON output:
- `all_passed: true` → proceed to STEP 7
- `all_passed: false` → enter FIX LOOP (max 3 iterations):

#### Fix loop:
```bash
# Send failure output back to local model
python scripts/local_model.py --story {story_id} --mode fix \
  --prompt "$(python scripts/validate_story.py --story {story_id} 2>&1)" \
  --output /tmp/fix_{story_id}.txt
python scripts/validate_story.py --story {story_id}
```
After 3 failed fix iterations: mark story as BLOCKED, skip, continue to next story.

### STEP 7 — Architecture judgment (YOU do this)
Read the files written by the local model.
Verify:
1. No forbidden imports (agents/ → execution/oms/broker/)
2. No LLM imports in risk/engine/
3. Pydantic v2 syntax used
4. SQLAlchemy 2 syntax used
5. Tests actually test the acceptance criteria

If you find violations: feed them back to local model (fix loop, same as STEP 6).

### STEP 8 — Create PR
```bash
python scripts/pr_creator.py \
  --story {story_id} \
  --issue {issue_number} \
  --title "{story_short_title}"
```
Wait for PR URL. Report to user: `✅ PR created: {pr_url}`

### STEP 9 — Update GitHub issue
```bash
gh issue comment {issue_number} --repo orisonsoto/AM-TradingAgents \
  --body "✅ Implemented in PR above. Awaiting review and merge."
```

### STEP 10 — Loop
Go back to STEP 2 and pick the next story.

---

## Stopping conditions

Stop the loop when any of these are true:
- Local SLM unreachable after 2 retries
- User sends a message (interrupt)
- All 20 stories are DONE
- 3 consecutive stories fail validation after fix loop
- `git status` shows uncommitted conflicts

---

## State tracking

After each story, report a one-line status:
```
[US-INFRA-0001] ✅ DONE (PR #2) | [US-INFRA-0002] 🔄 IN PROGRESS | remaining: 18
```

---

## Important rules

1. **Never merge PRs yourself** — leave that for human review unless user explicitly says to auto-merge.
2. **Never switch to LIVE trading mode** — this loop is for development only.
3. **Never commit .env files** — check `git status` before every commit.
4. **One story per branch** — never mix two stories in one PR.
5. **Return to `main` branch** after each PR is pushed:
   ```bash
   git checkout main && git pull origin main
   ```
6. **If a story has no issue on GitHub** — create it first with `gh issue create`.
7. **The local model is slow** — do not timeout before 300 seconds.

---

## Quick start command sequence

```bash
# 1. Health check
python scripts/local_model.py --mode health

# 2. Pick story
python scripts/story_picker.py

# 3. Implement (blocks until done)
python scripts/local_model.py --story US-INFRA-0001 --mode implement

# 4. Validate
python scripts/validate_story.py --story US-INFRA-0001

# 5. PR
python scripts/pr_creator.py --story US-INFRA-0001 --issue 2 --title "Repository structure CI skeleton"
```
