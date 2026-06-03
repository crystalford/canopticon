# Admin probe — Claude's window into the live system

Claude Code runs in a sandbox whose network is restricted to an allowlist
of hosts (GitHub, package registries). It **cannot** reach
`canopticon.com` directly. This probe bridges that gap: a GitHub Action
runner — which *can* reach the site — calls it on Claude's behalf and
commits the response back into the repo, where Claude reads it via the
GitHub API.

No copy-pasting logs. No background polling. The probe runs only when
Claude triggers it, takes ~15 seconds, and never loops.

## The loop

1. Claude triggers the `Canopticon admin probe` workflow via the GitHub
   API (`workflow_dispatch`) with inputs: `path`, `method`, optional `body`.
2. The runner curls `https://canopticon.com<path>` with the Cloudflare
   Access service-token headers.
3. It writes the result to `ops/probe/response.json` and commits it.
4. Claude reads `ops/probe/response.json`.

`response.json` shape:

```json
{
  "requested_at": "2026-06-03T11:50:00Z",
  "run_id": "123456789",
  "method": "GET",
  "path": "/v1/admin/runtime",
  "status": 200,
  "body": "…the response body as a string…"
}
```

## What Claude usually calls

- `GET /v1/admin/runtime` — counts, recent `orchestrator_events` bucketed
  by type (this is where errors land), pending entity-update proposals,
  recent pieces. The default debugging call.

Other single-resource, synchronous admin endpoints can be driven the same
way. **Never** point the probe at anything that loops or batches over many
records — that burns Actions minutes. Heavy work belongs on Cloudflare.

## One-time setup (you do this, ~5 min)

### 1. Create a Cloudflare Access service token
Zero Trust → **Access → Service Auth → Service Tokens** → *Create Service
Token* named `claude-code-bridge`. Copy the **Client ID** and **Client
Secret** (the secret is shown once).

### 2. Allow the token on the canopticon Access application
Zero Trust → **Access → Applications → [canopticon]** → **Policies** → add
a policy:
- **Action:** Service Auth
- **Include:** Service Token → `claude-code-bridge`
- Save (set a duration, e.g. 1 month, if prompted).

This lets the token through Access without SSO. Access injects a signed
JWT carrying the token's `common_name`; the app's auth layer
(`packages/api/src/auth/middleware.ts`) verifies that JWT and treats it
as the sole operator. (A bare client-id header is not trusted — only the
signed JWT is.)

### 3. Add the token to GitHub repo secrets
Repo → **Settings → Secrets and variables → Actions → Repository secrets**:
- `CF_ACCESS_CLIENT_ID`
- `CF_ACCESS_CLIENT_SECRET`

Once those three steps are done, Claude fires one probe to confirm the
loop works end-to-end.
