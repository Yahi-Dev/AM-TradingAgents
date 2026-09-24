# GitHub Branch Protection Requirements

These settings must be configured via the GitHub repository settings UI
(or via GitHub API/Terraform). They cannot be set via files in the repository.

## main branch protections

Navigate to: Settings → Branches → Add branch protection rule → `main`

| Protection | Setting | Required |
|---|---|---|
| Require pull request before merging | ✅ Enabled | Yes |
| Required approvals | 1 (human) | Yes |
| Dismiss stale reviews on new commits | ✅ Enabled | Yes |
| Require status checks to pass | ✅ Enabled | Yes |
| Required status checks (see below) | Listed below | Yes |
| Require branches to be up to date | ✅ Enabled | Yes |
| Require conversation resolution | ✅ Enabled | Yes |
| Include administrators | ✅ Enabled | Yes — no bypass |
| Allow force pushes | ❌ Disabled | Never enable |
| Allow deletions | ❌ Disabled | Never enable |

## Required Status Checks (must pass before merge to main)

These are the CI job names as they appear in GitHub Actions:

```
tests (3.12)
lint
architecture fitness functions
secret scan
```

Add these as required checks in the branch protection rule.

The following are run but not yet required (add as they stabilize):
```
mypy
tests (3.10)
tests (3.11)
tests (3.13)
clean-install smoke
```

## desarrollo-agentico branch

Same protections as main, with:
- Required approvals: 0 (autonomous PRs from feature/ branches merge via review)
- This branch should not be directly committed to; use feature/US-XXXX-* branches

## feature/* branches

No protection — the orchestrator creates and pushes these freely.

## Notes

- **CODEOWNERS file** (`.github/CODEOWNERS`): Consider adding owners for
  `tradingagents/risk/`, `tradingagents/execution/`, `tradingagents/oms/`
  requiring human review for ORANGE-classified files.
- **Environments** (Settings → Environments): Create `paper` and `live` environments
  with required reviewers for the `live` environment to enforce LIVE promotion policy.
- **Secrets** (Settings → Secrets): Store `ANTHROPIC_API_KEY`, `GH_TOKEN` only.
  Never store `SCHWAB_*` in repo-level secrets — those belong in deployment secrets only.
