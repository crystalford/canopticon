# CANOPTICON — Setup Guide (web-only, no terminal)

> Verified against UI labels on **April 25, 2026**. If a label moved,
> look in the same neighborhood — the option is usually right where
> you'd expect it.

You will set this up entirely through web dashboards plus GitHub's
"Run workflow" buttons. No local IDE, no terminal commands.

By the end:
- `canopticon.com` — public site
- `canopticon.com/home` (signed in) — your operator dashboard
- `api.canopticon.com` — the API on Cloudflare Workers
- Supabase as the database
- Anthropic as the AI

Total time: about **75 minutes**.

---

## About the things you might be wondering

**`pnpm`, `wrangler`, `supabase` commands?** You'll never type any of
them. We've set up GitHub Actions so every command runs on GitHub's
servers when you click a "Run workflow" button. `pnpm smoke` =
clicking "Run workflow" on the Smoke workflow. Etc.

**Video storage?** The current build is text-only. Sources hold
transcripts as text. If you want video later, that's a separate
add-on (Cloudflare Stream + R2). Skip it for v1.

**Cost?** Cloudflare and Supabase are free for what you need.
Anthropic is pay-as-you-go: budget **$20–50/month** to start. Hard-cap
your spend in the Anthropic dashboard before you start.

---

## Step 1 — Fork the repo on GitHub (2 min)

1. Go to <https://github.com/crystalford/canopticon>.
2. Click **Fork** (top-right). Accept defaults.
3. You now own a copy at `https://github.com/<your-username>/canopticon`.

---

## Step 2 — Create the Supabase project (10 min)

1. Sign in at <https://supabase.com>.
2. Top-right: **New project**.
3. Fill in:
   - **Name**: `canopticon`
   - **Database password**: click **Generate**, then copy it to a
     password manager.
   - **Region**: closest to you.
   - **Plan**: Free.
4. Click **Create new project**. Wait 1–2 minutes.

### 2a — Grab your keys

Click the gear icon (bottom-left) → **Project Settings** → **API**.

Copy these four values to a notes file (you'll paste them into other
dashboards in the next steps):

| Label in Supabase UI | Save this as |
|---|---|
| **Project URL** | `SUPABASE_URL` |
| **anon public** key | `SUPABASE_ANON_KEY` |
| **service_role** key (click Reveal) | `SUPABASE_SERVICE_ROLE_KEY` |
| **JWT Secret** (further down on the same page, click Reveal) | `SUPABASE_JWT_SECRET` |

### 2b — Run the migrations

You'll paste the 18 migration files into the Supabase SQL Editor in
order. This creates all 37+ tables.

1. In Supabase sidebar: **SQL Editor**.
2. In a second browser tab, open
   <https://github.com/<your-username>/canopticon/tree/main/supabase/migrations>.
3. For **each file in order from 0001 to 0018**:
   - Click the file (e.g., `0001_extensions.sql`).
   - Click the **Copy raw file** button (top-right of the file
     viewer).
   - Back in Supabase SQL Editor → **+ New query**.
   - Paste. Click **Run** (bottom-right, or Ctrl/Cmd-Enter).
   - Wait for "Success" message.
   - Repeat for next file.

If a migration errors, **stop and read the error**. Most likely cause:
you ran them out of order, or you ran the same one twice. Worst case:
in **Database → Backups** you can reset. (You haven't put real data in
yet, so resetting costs nothing.)

### 2c — Verify

In Supabase sidebar: **Table Editor**. Top-left dropdown should be
`public`. You should see **37+ tables** including `users`, `claims`,
`theses`, `findings`, `predictions`, `cost_ledger`.

If yes: ✅ Supabase is set up. Move on.

---

## Step 3 — Get an Anthropic API key (3 min)

1. Sign up at <https://console.anthropic.com>.
2. Sidebar: **Billing** → add at least **$5** in credits.
3. Sidebar: **Billing** → **Set spend limit** → set monthly cap
   ($25 recommended for v1).
4. Sidebar: **API Keys** → **Create Key**.
5. Name it `canopticon-prod`.
6. Copy the key (starts with `sk-ant-`). Save as `ANTHROPIC_API_KEY`.

---

## Step 4 — Create a Cloudflare API token (3 min)

You need an API token so GitHub Actions can deploy the API to your
Cloudflare account.

1. Sign in at <https://dash.cloudflare.com>.
2. Top-right profile icon → **My Profile** → **API Tokens** tab.
3. Click **Create Token**.
4. Pick **Edit Cloudflare Workers** template → **Use template**.
5. Under **Account Resources**: select your account.
6. Under **Zone Resources**: select **All zones** (so the token can
   manage `canopticon.com` later).
7. Click **Continue to summary** → **Create Token**.
8. Copy the token. Save as `CLOUDFLARE_API_TOKEN`. **You will not see
   it again.**
9. Also grab your **Account ID**: dashboard home → right sidebar.
   Save as `CLOUDFLARE_ACCOUNT_ID`.

---

## Step 5 — Add GitHub secrets (5 min)

GitHub Actions needs to know all your keys to deploy and run scripts.

1. In your fork: **Settings** (top tab) → **Secrets and variables** →
   **Actions** (left sidebar).
2. Click **New repository secret** for each of these. Paste the value
   you saved earlier. Use the exact name shown.

| Secret name | Value |
|---|---|
| `SUPABASE_URL` | from Step 2a |
| `SUPABASE_ANON_KEY` | from Step 2a |
| `SUPABASE_SERVICE_ROLE_KEY` | from Step 2a |
| `SUPABASE_JWT_SECRET` | from Step 2a |
| `ANTHROPIC_API_KEY` | from Step 3 |
| `CLOUDFLARE_API_TOKEN` | from Step 4 |
| `CLOUDFLARE_ACCOUNT_ID` | from Step 4 |

After saving each one, you should see seven secrets listed.

---

## Step 6 — Deploy the API to Cloudflare Workers (5 min)

GitHub Actions will do the deploy for you.

1. In your fork: **Actions** tab.
2. Left sidebar: **Deploy API to Cloudflare Workers**.
3. Right side: **Run workflow** → branch `main` → green **Run
   workflow** button.
4. Wait ~3 minutes. Refresh. Click the run to see live logs. Look for
   the green checkmark.

When done, find the deployed URL:

1. <https://dash.cloudflare.com> → **Workers & Pages** (left sidebar).
2. Click `canopticon-api` → look at the top — there's a URL like
   `https://canopticon-api.<account>.workers.dev`.
3. Visit that URL + `/health` in your browser. Should print
   `{"ok":true}`.

If yes: ✅ API is live.

---

## Step 7 — Deploy the web to Cloudflare Pages (10 min)

1. <https://dash.cloudflare.com> → **Workers & Pages** → **Create**
   button → **Pages** tab → **Connect to Git**.
2. Authorize Cloudflare to access your GitHub. Pick your `canopticon`
   fork. Click **Begin setup**.
3. Fill in the build configuration:

| Field | Value |
|---|---|
| **Project name** | `canopticon-web` |
| **Production branch** | `main` |
| **Framework preset** | None |
| **Build command** | `cd packages/web && pnpm install --frozen-lockfile && pnpm pages:build` |
| **Build output directory** | `packages/web/.vercel/output/static` |

4. Expand **Environment variables (advanced)** and add three:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | from Step 2a |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from Step 2a |
| `NEXT_PUBLIC_API_BASE_URL` | `https://api.canopticon.com` |

> The API URL is the future custom-domain URL we'll set up in Step 8.
> Even though it doesn't resolve yet, set it now — the web is built
> with this value embedded.

5. Click **Save and Deploy**. First build takes 3–5 min.

### 7a — Set the compatibility flag (don't forget this)

After the first deploy succeeds:

1. In `canopticon-web` → **Settings** (top) → **Functions** (left).
2. Scroll to **Compatibility flags**.
3. **Production**: click **Add flag**, type `nodejs_compat`, save.
4. **Preview**: same — add `nodejs_compat`.

Then redeploy:

1. **Deployments** tab.
2. On the latest deployment, click the **⋯** menu → **Retry
   deployment**.

### 7b — Verify

Visit the temporary URL Cloudflare gave you (looks like
`https://canopticon-web.pages.dev`). You should land on a sign-in
page.

If yes: ✅ Web is deployed.

---

## Step 8 — Connect canopticon.com (10 min)

You already own `canopticon.com` on Cloudflare DNS — this part is
fast.

### 8a — Point canopticon.com at Pages

1. <https://dash.cloudflare.com> → **Workers & Pages** →
   `canopticon-web` → **Custom domains** tab.
2. **Set up a custom domain** → enter `canopticon.com` → **Continue**.
3. Cloudflare offers to add the DNS record automatically — accept.
4. Repeat for `www.canopticon.com`.

Wait 1–5 minutes for DNS to propagate. Visit
<https://canopticon.com> — you should see the public site (or be
redirected to sign-in).

### 8b — Point api.canopticon.com at the Worker

1. **Workers & Pages** → click `canopticon-api` (the Worker, not the
   Pages project).
2. **Settings** (top) → **Domains & Routes** (left).
3. **Add** → **Custom domain** → enter `api.canopticon.com` → save.

Visit <https://api.canopticon.com/health> — should print
`{"ok":true}`.

If yes: ✅ Domain wired up.

---

## Step 9 — Sign in for the first time (3 min)

1. Visit <https://canopticon.com/sign-in>.
2. Enter your email.
3. Click **Send magic link**.
4. Check your inbox. Email is from `noreply@mail.app.supabase.io` —
   check spam if it's not in your inbox in 30 seconds.
5. Click the link. You'll land on `/home`.

If you land on `/home`: ✅ Auth works.

> Note: by default the magic link goes to the temporary
> `pages.dev` URL. To fix that, in Supabase: **Authentication** →
> **URL Configuration**:
>   - **Site URL**: `https://canopticon.com`
>   - **Redirect URLs**: add `https://canopticon.com/auth/callback`
>
> Save. Future magic links go to your real domain.

---

## Step 10 — Push the skill prompts (2 min)

The migrations seeded `role_definitions` rows but with **placeholder
prompts**. You must run sync-skills now or every Claude call will go
out with garbage.

1. In your GitHub fork: **Actions** tab.
2. Left sidebar: **Sync skill prompts to Supabase**.
3. **Run workflow** → leave inputs blank → green **Run workflow**.
4. Wait ~30 seconds. Refresh. Open the run. Confirm green checkmark
   and "13 synced, 0 skipped" in the logs.

---

## Step 11 — Run the smoke test (2 min)

Final verification that everything works.

1. In GitHub: **Actions** tab.
2. Left sidebar: **Smoke test (verify Supabase setup)**.
3. **Run workflow** → green **Run workflow**.
4. Wait ~30 seconds. Open the run.

You want to see all seven checks pass:

```
· Supabase reachable ... ok
· All expected tables exist ... ok
· All 13 role_definitions exist for at least one user ... ok
· Skill prompts have been synced (no placeholders) ... ok
· Every role_definitions row references a real SKILL.md ... ok
· Cost gate tables ready ... ok
· Findings substrate ready (migration 0018 applied) ... ok

7 passed, 0 failed
substrate looks healthy. ready to use.
```

If any check fails, **the failure message tells you what to fix** —
usually re-run sync-skills, or re-paste a missing migration.

If all 7 pass: ✅ **You're done. The system is live.**

---

## Step 12 — Try it (10 min, ~$1 in Anthropic)

1. <https://canopticon.com/research>.
2. Type a research topic. Click **Run**.
3. Watch the live event feed. ~2 min.
4. Go to `/sources` → review what came in → **Approve** the ones you
   trust.
5. Wait for the cascade (cron fires every 6 hours, or manually
   trigger it from `/system`).
6. Go to `/claims` → see what got extracted.
7. `/studio` → **+ new thesis** → declare → integrate a few claims.
8. From the thesis page: **surface findings**, **declare prediction**,
   **publish**.
9. <https://canopticon.com/p/theses/your-slug> — your thesis is live
   on the public site.

---

## What you do daily

You don't touch GitHub or the Cloudflare dashboard for normal use.
You just visit <https://canopticon.com/home>, sign in, and work.

You only re-touch this guide when:

- **You changed a SKILL.md prompt**: re-run "Sync skill prompts to
  Supabase" workflow.
- **You added a new migration file** (you probably won't): paste it
  into Supabase SQL Editor, then re-run smoke.
- **You deployed an API code change**: GitHub Actions auto-deploys on
  every push to main.
- **You deployed a web code change**: Cloudflare Pages auto-deploys on
  every push to main.

---

## Troubleshooting

**Pages build fails with "Cannot find module"**
The build command is wrong. Check Step 7 — it must start with
`cd packages/web && pnpm install --frozen-lockfile && ...`.

**Pages site loads but every page shows "Internal Server Error"**
You forgot the `nodejs_compat` flag (Step 7a). Add it, retry the
deployment.

**"Sync skill prompts" workflow says "0 rows updated"**
No `users` row exists yet. You need to sign in via the web (Step 9)
first, then re-run the workflow.

**Smoke test says "5 role_definitions still have placeholder prompts"**
Re-run "Sync skill prompts to Supabase" workflow.

**Anthropic returns 401 / 403 in the system feed**
Either the key is wrong (re-edit the `ANTHROPIC_API_KEY` GitHub
secret, then re-run "Deploy API to Cloudflare Workers") or you're out
of credit (top up at console.anthropic.com).

**Magic link arrives but clicking it goes to pages.dev not
canopticon.com**
See Step 9 — set Site URL + Redirect URLs in Supabase Authentication.

**Cost gate keeps blocking everything**
The Cost Approval modal shows pending operations. Find it at the
top-right of any operator page; approve to continue.

---

## Where things live

| What | Where |
|---|---|
| Database tables | Supabase → Table Editor |
| Run a SQL query | Supabase → SQL Editor |
| API logs | Cloudflare → Workers & Pages → canopticon-api → Logs |
| Web build logs | Cloudflare → Workers & Pages → canopticon-web → Deployments |
| Anthropic spend | console.anthropic.com → Billing → Usage |
| GitHub secrets | github.com/<you>/canopticon → Settings → Secrets and variables → Actions |
| Run sync-skills | github.com/<you>/canopticon → Actions → Sync skill prompts → Run workflow |
| Run smoke | github.com/<you>/canopticon → Actions → Smoke test → Run workflow |
| Re-deploy API | github.com/<you>/canopticon → Actions → Deploy API → Run workflow |
| Custom domains | Cloudflare → canopticon.com → DNS / Workers & Pages routes |
| Operator UI | https://canopticon.com (signed in) |
| Public site | https://canopticon.com (signed out) |
| API | https://api.canopticon.com |
