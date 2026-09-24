# Rollback Procedures

## Application Code

**Scope:** Any merged PR that introduced a bug.

```bash
# Revert the specific commit
git revert <commit-sha> --no-edit
git push origin main
# Open a PR for the revert (same process as any PR)
```

- Never use `git reset --hard` on a shared branch
- Revert PR must reference the original story and PR being reverted
- CI must pass on the revert PR before merge

## Database Migrations

**Additive migrations** (new tables/columns): can be rolled back with Alembic down migration.

```bash
alembic downgrade -1   # revert one migration
alembic downgrade <revision_id>  # revert to specific revision
```

**Destructive migrations** (column removal, table drop, data transformation):
- **Never assume safe to roll back automatically**
- Rollback plan must be documented in the PR before merge
- Data backup required before applying
- If rolled back, data written during the migration window may be lost

**Rule:** Any PR with `migration_impact: destructive` requires an explicit rollback plan in the PR body before it can be merged.

## Configuration Rollback

Configuration is version-controlled. Rollback = revert the config commit.
For runtime config (env vars): change the env var value and restart the service.

## Prompt Rollback

Prompts are versioned in `docs/control-plane/model-registry.yaml`.
To roll back a prompt:
1. Change `prompt_version` in model-registry.yaml to the previous version
2. Update the template in `scripts/local_model.py`
3. Bump `configuration_version`
4. Deploy as a normal PR

## Model Rollback

To roll back to a previous model:
1. Change `physical_model` in model-registry.yaml for the affected role
2. Bump `model_version` and `configuration_version`
3. Deploy as a normal PR

## Strategy Rollback

Trading strategy parameters live in configuration (not code).
Rollback = revert config change + restart trading runtime.
Active paper trading runs will be affected; they should be allowed to complete naturally.

## LIVE Trading Rollback (Emergency)

1. Activate Kill Switch immediately
2. All pending TradeIntents will be REJECTED
3. All open orders will attempt cancellation via broker
4. Notify operations team
5. Investigate root cause before re-enabling

**Kill Switch cannot be activated by an autonomous coding agent.**
It requires a human action via the admin interface or direct API call with authentication.
