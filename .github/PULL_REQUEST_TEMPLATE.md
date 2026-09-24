## Story
<!-- Required: story ID and title -->
**Story ID:** <!-- US-XXXX-NNNN -->
**Story Title:** <!-- short title -->
**GitHub Issue:** <!-- Closes #N -->

## Requirement IDs
<!-- List the REQ-FUNC-NNNN or REQ-NFR-NNNN IDs this PR satisfies -->
- REQ-FUNC-

## Summary
<!-- 2-3 sentences: what was built and why -->

## Scope
<!-- What IS in scope for this PR -->
-

## Out-of-Scope Confirmation
<!-- Explicitly list what was NOT done (prevents scope confusion) -->
- [ ] No changes to protected modules (list from story contract)
- [ ] No features beyond the story acceptance criteria

## Architecture Impact
<!-- Did this PR introduce any new architectural patterns or dependencies? -->
- [ ] No architecture changes
- [ ] Architecture change — ADR referenced below

**ADR reference (if applicable):** <!-- docs/12-adr/ADR-NNNN.md -->

## Database Impact
- [ ] No migration
- [ ] Additive migration (new table/column, existing data preserved)
- [ ] Destructive migration (requires rollback plan below)

**Rollback plan (if migration):**

## API Impact
- [ ] No API changes
- [ ] New endpoint added
- [ ] Breaking change (requires versioning plan)

## Security Impact
- [ ] No security-relevant changes
- [ ] Auth/authorization changes — reviewed for YELLOW risk requirements
- [ ] New credential or secret — documented in secret-boundaries.md

## Observability Impact
- [ ] Metrics/logs/traces added as per story contract
- [ ] No observability requirements for this story

## Tests
- [ ] Unit tests added in `tests/unit/`
- [ ] All acceptance criteria covered by tests
- [ ] Architecture fitness functions pass
- [ ] No tests weakened or disabled to make CI pass

## Acceptance Criteria Evidence
<!-- For each AC in the story contract, confirm it is met -->
- [ ] AC-1: GIVEN ... WHEN ... THEN ...
- [ ] AC-2: ...

## Risk Level
<!-- GREEN / BLUE / YELLOW / ORANGE / RED — see docs/control-plane/autonomy-risk-levels.yaml -->
**Risk:** <!-- GREEN -->

## Human Approval Required
- [ ] Yes (YELLOW+ stories)
- [ ] No (GREEN/BLUE)

## Rollback
<!-- How to safely revert this PR if needed -->

## CI Checklist
- [ ] ruff
- [ ] mypy
- [ ] pytest
- [ ] architecture fitness functions
- [ ] traceability check (story ID referenced)
- [ ] secret scan

---
🤖 Generated with [Claude Code](https://claude.com/claude-code)
