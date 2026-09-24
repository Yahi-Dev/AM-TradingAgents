# Secret Boundaries for Coding Agents

Coding agents in the autonomous development loop operate with **zero access to production credentials**.

## Credential Classification

| Credential Class | Examples | Dev Loop Access |
|---|---|---|
| **Development Automation** | GH_TOKEN (repo+project scopes), LOCAL_SLM_URL | ✅ Allowed |
| **CI** | GitHub Actions secrets (RUFF_TOKEN, etc.) | ✅ Read-only via CI env |
| **Trading Runtime (Paper)** | Paper broker config (no real money) | ✅ Test/dev only |
| **Schwab Developer Sandbox** | SCHWAB_SANDBOX_KEY | ⛔ Never in code agent context |
| **Schwab Production** | SCHWAB_API_KEY, SCHWAB_CLIENT_SECRET | 🔴 Never accessible to any agent |
| **Production DB** | DATABASE_URL (production) | 🔴 Never accessible to any agent |
| **LIVE Trading Activation** | SCHWAB_TRADING_MODE=live + confirm=True | 🔴 Human only |
| **Deployment secrets** | Cloud provider keys, SSH keys | 🔴 Never accessible to any agent |

## Enforcement Rules

1. **Coding agents receive ONLY `.env.development` variables** — never `.env.production`
2. **`.env` files are `.gitignore`d** — the CI check must fail if any `.env.*` with real credentials is committed
3. **`GH_TOKEN`** used by the orchestrator is a scoped PAT: `repo` + `project` only; no admin, no secrets management
4. **Local SLM** has no network access to Schwab endpoints; it only generates Python code
5. **`SCHWAB_TRADING_MODE`** environment variable is explicitly absent from all development contexts
6. **Traceability**: Any PR that introduces a new environment variable must document it in the PR description with its classification

## Least Privilege by Context

```
Development Automation Context (dev loop):
  GH_TOKEN                  → repo:read/write, project:read/write
  LOCAL_SLM_URL             → local network only
  DATABASE_URL              → local dev DB (docker compose)
  no SCHWAB_*               → absent

CI Context (GitHub Actions):
  GITHUB_TOKEN              → auto-provisioned, repo-scoped
  no SCHWAB_*               → absent
  no production DB          → absent

Trading Runtime (Paper):
  SCHWAB_TRADING_MODE=paper → default, never live
  DATABASE_URL              → paper trading DB
  no production Schwab creds

Trading Runtime (LIVE):
  SCHWAB_API_KEY            → human-provisioned at runtime
  SCHWAB_TRADING_MODE=live  → requires confirm=True on EVERY order call
  Multi-person authorization required
```

## Secret Scanning

All PRs must pass the `secret_scan` CI check. The scan covers:
- Hardcoded API keys (regex patterns for known formats)
- `SCHWAB_*` values in code or test fixtures
- Private key patterns (-----BEGIN PRIVATE KEY-----)
- JWT secrets
- Any string matching `sk-`, `ghp_`, `xoxb-`

**If a secret is accidentally committed**: stop the dev loop immediately, do not push, notify human. See `docs/control-plane/retry-policy.yaml::failure_types::secret_in_output`.
