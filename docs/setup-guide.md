# CANOPTICON Setup Guide

All Cloudflare. No third-party database, no third-party auth. One vendor for infra, Anthropic for the model, your video editor of choice for production. About 25 minutes of dashboard clicking total.

## What you'll have at the end

- Operator app at `canopticon.com/live` (gated to your email by Cloudflare Access)
- Public site at `canopticon.com/p/*` (no auth)
- API at `api.canopticon.com`
- Database, file storage, and embeddings all on Cloudflare
- Anthropic Claude as the only external service

## Prerequisites

- A Cloudflare account with `canopticon.com` already on Cloudflare DNS *(you have this)*
- A GitHub account with the repo forked *(you have this)*
- About $0 in monthly bills until you grow (everything sits on free tiers)
- An [Anthropic API key](https://console.anthropic.com/) (their dashboard, API Keys → Create Key)

---

## Phase 1 — GitHub Secrets *(5 min)*

### 1.1 Get your Cloudflare Account ID

1. Open **[dash.cloudflare.com](https://dash.cloudflare.com)** and sign in
2. Left sidebar → **Workers & Pages**
3. On the right, find the **Account ID** field with a Copy button → copy it
4. Save it somewhere temporarily (Notes, etc.)

### 1.2 Create a Cloudflare API Token

1. Top-right → click your profile picture → **My Profile**
2. Left sidebar → **API Tokens**
3. **Create Token** (big blue button) → scroll to "Custom token" → **Get started**
4. Token name: `canopticon-deploy`
5. Add these permissions (click **+ Add more** for each):
   - **Account** | **Workers Scripts** | **Edit**
   - **Account** | **Workers R2 Storage** | **Edit**
   - **Account** | **D1** | **Edit**
   - **Account** | **Cloudflare Pages** | **Edit**
   - **Account** | **Account Settings** | **Read**
   - **Account** | **Vectorize** | **Edit**
   - **User** | **Memberships** | **Read**
6. **Account Resources**: leave as "All accounts" (or pick your specific account)
7. **Continue to summary** → **Create Token**
8. **Copy the token immediately** — it only shows once. Save next to the Account ID.

### 1.3 Add four secrets to GitHub

1. Go to **github.com/your-username/canopticon → Settings**
2. Left sidebar → **Secrets and variables** → **Actions**
3. Click **New repository secret** four times:
   - Name: `CLOUDFLARE_ACCOUNT_ID` — Value: (the account ID)
   - Name: `CLOUDFLARE_API_TOKEN` — Value: (the API token)
   - Name: `ANTHROPIC_API_KEY` — Value: your Anthropic key
   - Name: `OPERATOR_EMAIL` — Value: your email (the only address that will be able to sign in)

---

## Phase 2 — Run the deploy workflow *(~5 min)*

1. Go to **github.com/your-username/canopticon → Actions**
2. Left sidebar → **Deploy to Cloudflare**
3. Right side → **Run workflow** → green button confirming **Run workflow**

Watch the live log. The workflow does all of this for you:

1. Creates the `canopticon` D1 database
2. Runs all migrations (creates 60+ tables)
3. Creates the `canopticon-files` R2 bucket (for recordings, source documents)
4. Creates the `canopticon-embeddings` Vectorize index
5. Pushes your Anthropic key as a Worker secret
6. Deploys the API Worker at `canopticon-api.<your-account>.workers.dev`
7. Builds and deploys the web app to Cloudflare Pages at `canopticon-web.pages.dev`

If it goes green, the site is live at the temporary Cloudflare URLs.

**If it goes red**: open the failed step in the log, copy the error, and we'll debug.

---

## Phase 3 — Wire your domain *(~10 min)*

### 3.1 Pages → canopticon.com

1. Cloudflare dashboard → **Workers & Pages**
2. Find `canopticon-web` → click it
3. Top tabs → **Custom domains**
4. **Set up a custom domain** → enter `canopticon.com` → **Continue** → **Activate domain**
5. Repeat with `www.canopticon.com`

DNS records auto-created since canopticon.com is already on Cloudflare. SSL is automatic.

### 3.2 Worker → api.canopticon.com

1. Cloudflare dashboard → **Workers & Pages**
2. Find `canopticon-api` → click it
3. Top tabs → **Settings** → **Domains & Routes**
4. **Add** → **Custom Domain** → enter `api.canopticon.com` → **Add Custom Domain**

### 3.3 Tell the web where the API lives

The deploy workflow ships the web with `NEXT_PUBLIC_API_BASE_URL` pointing to the temporary workers.dev URL. Update it to point at your new custom domain:

1. Cloudflare dashboard → **Workers & Pages** → `canopticon-web`
2. **Settings** → **Environment variables**
3. **Add variable**:
   - Variable name: `NEXT_PUBLIC_API_BASE_URL`
   - Value: `https://api.canopticon.com`
   - Environment: **Production**
4. **Save**
5. **Deployments** tab → top of the list → **⋯** menu → **Retry deployment** (so the build picks up the new env var)

---

## Phase 4 — Lock down the operator app *(~5 min)*

Cloudflare Access gates `canopticon.com/live` (and the other operator screens) to your email. The public site (`/p/*`) stays open to everyone.

### 4.1 Activate Zero Trust (free)

1. Cloudflare dashboard → left sidebar → **Zero Trust**
2. First time only: pick a team name (e.g. `canopticon`), choose the **Free** plan (no credit card)

### 4.2 Add the operator app

1. **Access** → **Applications** → **Add an application**
2. Choose **Self-hosted**
3. Application name: `Canopticon Operator`
4. Session duration: `1 month` (so you don't have to re-auth daily)
5. **Application domain**:
   - Domain: `canopticon.com`
   - Path: `live` *(this is one path; we add the others below)*
6. **Next**

### 4.3 Add the policy

1. Policy name: `Operator only`
2. Action: **Allow**
3. Include: **Emails** → enter your operator email exactly as you set it in GitHub Secrets (case-sensitive matters less, but matching matters)
4. **Next** → **Next** → **Add application**

### 4.4 Repeat for the other operator paths

Cloudflare Access only protects the exact path you list. Repeat 4.2 + 4.3 for these paths (same policy each time):
- `graph`
- `studio`
- `library`
- `sources`
- `system`

*(Tip: you can also create one app with multiple paths in newer Access UI — look for "Add path" within the same Application.)*

The public paths (`/p/articles`, `/p/theses`, etc.) and the homepage redirect aren't listed, so they stay unauthenticated.

---

## Phase 5 — Test it *(~2 min)*

1. Open `https://canopticon.com` in a fresh browser tab
2. You should land on Cloudflare Access's sign-in page
3. Enter your email → check inbox for the 6-digit code → paste it back
4. You should land on the **Live** screen (empty — no activity yet, that's expected)
5. Try the bottom-nav screens: Live / Graph / Studio / Library / Sources / System
6. In a separate tab (or incognito), visit `https://canopticon.com/p` — should load with no auth prompt

---

## Phase 6 — Sync the skill prompts *(~30 sec, one-time)*

After your first sign-in, the API has seeded your `users` row and 18 placeholder `role_definitions`. Now push the real prompts:

1. GitHub → **Actions** → **Sync skill prompts to D1**
2. **Run workflow** → green button

When it goes green, your 18 Anthropic prompts are live in the database. The cost gate is also seeded. You can now use the system.

---

## Phase 7 — Set the operator basics *(~2 min, optional but recommended)*

1. Open `canopticon.com/system`
2. **Named operator**: type your real name (this is what shows on published articles)
3. **Monthly ceiling**: default is $50. Adjust if you want a different cap on Anthropic spend.

That's it. You're operational.

---

## Daily use

- **Operator screens**: `canopticon.com/live` (+ /graph, /studio, /library, /sources, /system) — auth required
- **Public site**: `canopticon.com/p` — no auth, this is what readers see
- **Trigger a cascade**: Live screen → "Run Cascade" button
- **Add a source**: Sources screen → there's an upload affordance (top-right)

## Verifying setup

If anything feels off, run the smoke test:

1. GitHub → **Actions** → **Smoke test (verify deployment)** → **Run workflow**
2. It checks: API health, public endpoints return correct shapes, operator routes are gated by Access

## Where things live

| Thing | Where |
|---|---|
| Database (D1) | Cloudflare → Workers & Pages → D1 → `canopticon` |
| File storage (R2) | Cloudflare → R2 → `canopticon-files` |
| Embeddings (Vectorize) | Cloudflare → AI → Vectorize → `canopticon-embeddings` |
| API Worker | Cloudflare → Workers & Pages → `canopticon-api` |
| Web (Pages) | Cloudflare → Workers & Pages → `canopticon-web` |
| Access policies | Cloudflare → Zero Trust → Access → Applications |
| Anthropic key | Stored as Worker secret; rotate via redeploy with new GitHub secret |
| GitHub Actions logs | github.com/your-username/canopticon → Actions tab |

## Cost expectations

| Service | Free tier | When you'd pay |
|---|---|---|
| Cloudflare Pages | 500 builds/mo, unlimited bandwidth | Effectively never |
| Cloudflare Workers | 100k requests/day | $5/mo if you exceed |
| Cloudflare D1 | 5GB DB | ~never; this is text data |
| Cloudflare R2 | 10GB + 1M ops free | Pennies above that |
| Cloudflare Vectorize | 5M vectors, 30M queries/mo | ~never for a single operator |
| Cloudflare Access | 50 users free | Effectively never |
| Anthropic | Pay per token | Operator-controlled via System screen ceiling |

Realistic infra cost for a solo operator: **$0/mo**. The only number that moves is your Anthropic usage, which you cap in the System screen.

## Troubleshooting

**"NEXT_PUBLIC_API_BASE_URL is not set"** — finish Phase 3.3, then redeploy the web.

**Access prompts for sign-in but my email is rejected** — double-check `OPERATOR_EMAIL` in GitHub Secrets matches the email in the Access policy, exactly.

**Smoke test says operator routes returned 200** — Access isn't gating yet. Re-check Phase 4: the Application's domain + path must match the operator route URLs.

**API returns 401 on /v1/system from logged-in browser** — the API only trusts requests via Cloudflare Access. Make sure you're calling through `api.canopticon.com` (the Access-protected domain), not the `.workers.dev` URL directly.

**D1 migration failed mid-deploy** — open the failed workflow step, copy the error. Most common cause: tried to re-run a CREATE TABLE that already exists. D1 migrations are forward-only and idempotent in our setup; if you need to start fresh, drop the database in the Cloudflare dashboard and re-run the deploy workflow.

**I need to add a new operator email later** — update `OPERATOR_EMAIL` in GitHub Secrets (the Worker uses it) + add the email to the Access policy (Zero Trust gates with it). Both places.
