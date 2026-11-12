# Security audit — operator and admin surface, 2026-09-24

Scope: `packages/api` — every handler in `src/operator/routes.ts` and
`src/public/routes.ts`, the `/v1/admin/*` modules, the session and Access code
(`src/auth/*`, `packages/shared/src/auth.ts`), and the libraries those routes
call into (`graph/lib/record-builder.ts`, `answer-lead.ts`,
`answer-question.ts`, `lib/resurface.ts`, `lib/readings.ts`,
`public/render/margin-readings.ts`, plus the renderers the routes feed:
`investigations.ts`, `search.ts`, `research-workspace.ts`, `piece-template.ts`,
`markdown.ts`, the client scripts).

Four small fixes were applied, each pinned by `tests/security-audit.test.ts`.
Everything larger is described below with a proposed patch and was **not**
touched. Severity is for this deployment: one operator, one tenant, a public
read-only publication, Cloudflare Access on `/op/*` and `/v1/admin/*`.

---

## 1. How the surface is authenticated — read this first

There are three different postures, and the important finding is that they
are not the same thing:

| Surface | In-Worker check | What actually gates it |
|---|---|---|
| `/v1/admin/*` (`admin/runtime.ts`, `seed-corpus.ts`, `ingest-library.ts`) | `requireAuth()` — reads an email from `x-canopticon-email` / `cf-access-authenticated-user-email`, or decodes (does **not** verify) the JWT payload in `cf-access-jwt-assertion` / `x-canopticon-jwt`; compares to `OPERATOR_EMAIL` only if that var is non-empty | Cloudflare Access at the edge |
| `/op/*` (`operator/routes.ts`) | **none**. Every handler calls `resolveOperatorId(c.env.DB)`, which is `SELECT id FROM users ORDER BY created_at LIMIT 1` — it identifies the operator's row, it does not identify the caller. No cookie, no header, no JWT is read. | Cloudflare Access at the edge, and nothing else |
| public `/*` | `attachAuthState()` — verifies the HMAC session cookie (`canopticon_op`) and sets `is_operator` / `operator_id`; never throws | the cookie, for affordances only |

So **the whole operator surface is exactly as private as the Access
application's path list and hostname list**. The code is consistent about
this (the comments say so at every mount), and Access is a sound gate — but
two configuration facts widen it beyond what the comments assume:

1. **`wrangler.toml:5` sets `workers_dev = true`.** The Worker is also served
   at `canopticon-api.<account>.workers.dev`. Cloudflare Access applications
   are bound to hostnames; unless a second Access application covers the
   workers.dev hostname (verify in Zero Trust → Access → Applications), every
   `/op/*` POST and every `/v1/admin/*` GET is reachable there with **no
   authentication at all**, and for `/v1/admin/*` a request that supplies
   `x-canopticon-email: <operator>` passes `requireAuth()` outright, because
   that header is trusted verbatim (`auth/middleware.ts:59-66`).
2. **`OPERATOR_EMAIL = ""` in `wrangler.toml:68`.** With it empty,
   `requireAuth()` and `handleLogin()` skip the "is this the operator" check,
   and `getOrSeedOperator()` creates a fresh `users` row for any email that
   arrives. Whether that matters depends entirely on the Access policy's
   include rule being the one email. (The `[vars]` block may be overridden
   in the dashboard; the repo cannot tell.)

**Severity: HIGH (if workers.dev is not behind Access), otherwise
architectural note.** Only the operator can check:

```
curl -i -X POST https://canopticon-api.<subdomain>.workers.dev/op/process/all
curl -i https://canopticon-api.<subdomain>.workers.dev/v1/admin/runtime \
     -H 'x-canopticon-email: <the operator email>'
```

A 302 to `/library?queued=…` on the first, or a 200 JSON body on the second,
means the surface is open on that hostname.

**Proposed patch (not applied — it is auth architecture):**

- `wrangler.toml`: `workers_dev = false`. This alone closes the bypass; the
  custom domains are configured in the dashboard and are unaffected.
- Defence in depth, `src/operator/routes.ts`, after `const app = new Hono…`:

  ```ts
  import { readSessionCookie, verifySession } from "../auth/session";
  // Access is the gate; this is the belt. A request that carries neither an
  // Access identity nor a valid session cookie is refused before any handler
  // runs. /op/login is exempt: it is how the cookie gets minted.
  app.use("*", async (c, next) => {
    if (c.req.path === "/op/login") return next();
    const hasAccessIdentity =
      !!c.req.header("cf-access-jwt-assertion") ||
      !!c.req.header("cf-access-authenticated-user-email");
    let hasSession = false;
    const secret = c.env.SESSION_SECRET;
    const cookie = readSessionCookie(c.req.header("cookie"));
    if (secret && cookie) hasSession = !!(await verifySession(cookie, secret));
    if (!hasAccessIdentity && !hasSession) {
      return c.req.method === "GET" ? c.redirect("/op/login") : c.text("Not signed in", 401);
    }
    return next();
  });
  ```

  Every existing test that hits `/op/*` already sends the cookie
  (`leads-dig`, `workbench-replace`, `research-review`, …) **except**
  `ask-the-record`, `draft-tetrad`, `readings-page`, `research-sections-workspace`
  and `workbench-action-bar`, which would need a cookie header added — that is
  why this is proposed, not applied.
- `requireAuth()` should stop honouring the bare `x-canopticon-email` header
  (the Pages-tier proxy it was written for no longer exists) and, ideally,
  verify the Access JWT signature against the team's JWKS
  (`https://<team>.cloudflareaccess.com/cdn-cgi/access/certs`) rather than
  decoding the payload.

A related observation: `tests/leads-dig.test.ts` says "never start a run for
someone who is not the operator" and tests it by removing the `users` row
from the mock, not by dropping the cookie. It passes today because the route
never looks at the cookie. It is not testing what its comment claims.

---

## 2. Fixed in this audit

Each has a test in `packages/api/tests/security-audit.test.ts`.

### 2a. Model-written brief rendered through the unsanitised CMS renderer — MEDIUM

`src/operator/routes.ts` `GET /op/library/research/:id/review` rendered
`pieces.body_md` with `cms/lib/render-post.ts`, whose header says "HTML in
the markdown source passes through. We don't try to sanitize." That renderer
was written for operator-authored posts; a research draft is model-written
from **fetched third-party web pages** (`record-builder.ts` → `deep-research.ts`),
so a `<script>` or `onerror=` carried through a fetched page into the brief
would have executed on the operator's screen — stored XSS with the Access
cookie in scope. The research *workspace* review panel
(`research-workspace.ts:301`) already used the publication's escaping
renderer; this screen was the one that did not.

Fix: render with `public/render/markdown.ts` (`escapeHtml` first, link
schemes whitelisted), `{ anchors: false }`.

Remaining callers of the raw renderer, all off the live surface:
`admin/seed-corpus.ts`, `graph/lib/draft-reading.ts`, `profile-generator.ts`,
`briefs/pipeline.ts`, `routes/public.ts` (`/v1/public/posts`). None renders
model output from fetched pages on an operator page today, but the renderer
should be treated as unsafe for anything but operator-typed text.

### 2b. Open-redirect bypass with a backslash — LOW

`POST /op/research/advance` honoured `return_to` when it started with `/`
and not `//`; `/auth/login` and `/op/login` did the same for `?next=`.
Browsers normalise `\` to `/` in special schemes, so `/\evil.example`
resolves to `//evil.example`. Both guards now reject a second `/` **or** a
`\` (`/^\/(?![/\\])/`). Files: `src/operator/routes.ts`, `src/auth/routes.ts`.

### 2c. `GET /og/:file` reached R2 with an unconstrained key — LOW

The route only required a `.png` suffix, so `..%2F…` or an encoded slash
reached `env.FILES.get("og/" + file)`. R2 keys are flat strings and nothing
under `og/` but share cards exists, so there was no traversal to exploit — but
the contract is `og/<slug>.png` and now the route enforces it
(`/^[A-Za-z0-9_-]+\.png$/`). File: `src/public/routes.ts`.

### 2d. One operator query without `user_id` — LOW

`GET /op/library/import-video/:id/status` resolved the finished import's
piece with `SELECT slug FROM pieces WHERE id = ?`. The id came from a
`video_imports` row already filtered on `user_id`, so it was not exploitable,
but it was the one operator-route query in the file without the guard.
Now `AND user_id = ?`.

---

## 3. Found, not fixed — with proposed patches

### 3a. CSRF on every `/op/*` POST — MEDIUM (depends on Access cookie settings)

No `/op/*` POST checks `Origin`, `Sec-Fetch-Site` or a token. A page on
another site can submit `<form action="https://canopticon.com/op/library/delete" method="post"><input name="mode" value="all">` —
that route deletes the operator's entire corpus with no confirmation
(`operator/routes.ts:954`). Whether the browser attaches the Access
`CF_Authorization` cookie to that cross-site POST depends on the Access
application's *SameSite* setting (Zero Trust → Access → Applications →
canopticon → Settings → Cookie settings). The session cookie is
`SameSite=Lax` and would not be sent, but `/op/*` never reads it (§1).

Proposed (small, but every operator POST goes through it, so it is the
operator's call): in `operator/routes.ts` after the app is created —

```ts
// Same-site only: a browser sends Origin on every POST, and a form on
// another site cannot forge it. Absent Origin (curl, tests) passes.
app.use("*", async (c, next) => {
  if (c.req.method !== "POST") return next();
  const origin = c.req.header("origin");
  if (origin && new URL(origin).host !== new URL(c.req.url).host) {
    return c.text("cross-site request refused", 403);
  }
  return next();
});
```

And set the Access application's cookie SameSite attribute to `Lax` or
`Strict`.

### 3b. CORS reflects any origin with credentials — MEDIUM

`src/index.ts:41-47`: `cors({ origin: (origin) => origin ?? "*", credentials: true })`
on `*`. Any origin is echoed in `Access-Control-Allow-Origin` with
`Allow-Credentials: true`, on `/op/*` and `/v1/admin/*` included. A
cross-site `fetch(…, { credentials: "include" })` can therefore **read** the
response of any GET the browser's cookies unlock — e.g. `/op/research-status`,
`/op/feed/status`, `/v1/admin/runtime` (which carries error stacks) — subject
to the same SameSite question as 3a.

Proposed: restrict to the site's own origins, or drop credentials:

```ts
const ALLOWED = new Set(["https://canopticon.com", "https://www.canopticon.com",
  "https://studio.canopticon.com", "https://video.canopticon.com"]);
cors({ origin: (o) => (o && ALLOWED.has(o) ? o : ""), credentials: true, … })
```

Nothing in `packages/video` or `packages/studio` calls `/op/*` cross-origin
(grepped), so the operator surface could simply be excluded from CORS.

### 3c. Anonymous writes on the public site — LOW

- `public/render/search.ts` inserts an `orchestrator_events` row
  (`search.miss`) on **every anonymous search with no hits**. Unbounded,
  unauthenticated D1 growth; a loop of random queries fills the table.
- `public/routes.ts:81-97` inserts a `citation_hits` row for every request
  whose User-Agent matches an AI-crawler pattern. The UA is client-chosen, so
  the same applies (capped at 300 chars per row).
- `POST /subscribe` inserts a row per unique email and, when `RESEND_API_KEY`
  is set, sends a confirmation mail — no rate limit, so it is a mail-bombing
  vector by proxy once email is configured.

Proposed: a Cloudflare WAF rate-limiting rule on `POST /subscribe` and
`GET /search` (the dashboard, not code), and `LIMIT`-style caps on the two
log tables (e.g. refuse the insert when `COUNT(*) > 50_000`, or a daily
purge in the admin probe workflow — not a cron, rule 4).

### 3d. `/search` as the operator calls a model on GET — LOW (rule 5, not security)

`renderSearchPage` → `getAnswerPreview()` → `callRole(env, "writer", …)` runs
when the operator gets a miss. A GET that spends model budget is reachable by
clicking any link (Lax cookies ride top-level navigations), so a page of
`<a href="https://canopticon.com/search?q=…">` links the operator clicks is a
small denial-by-link. Also a straightforward rule-5 violation ("nothing calls
a model at render time"). Proposed: move it behind the existing
`POST /op/ask` button, or delete `answers-preview.ts` (it is the "preview"
that the answered-questions design superseded).

### 3e. Upload handling — LOW

`createAndExtract` (`operator/routes.ts:236`) materialises the whole upload
into memory (`new Response(body).arrayBuffer()`), and the zip path
(`routes.ts:70-130`) runs `unzipSync` over the whole archive before applying
`ZIP_MAX_ENTRIES = 100` — a highly compressed archive inflates fully in
memory before the cap is applied. `extract.ts` then caps extracted text at
200,000 chars, and R2 stores the raw bytes uncapped. In a Worker the
practical ceiling is the 128 MB isolate, so the worst case is an OOM on the
operator's own upload, not a compromise. Filenames are safe: `safeName()`
strips to `[a-zA-Z0-9._-]` and the R2 key is prefixed with a UUID; zip
entry names are reduced to their basename before use; `__MACOSX/` and
dot-files are skipped; MIME for zip entries is derived from the extension,
not trusted from the archive.

Proposed: reject `f.size > 25 * 1024 * 1024` before reading the body, and
pass `unzipSync(buf, { filter: (e) => … && e.originalSize < 10_000_000 })`
so an entry that would inflate past 10 MB is never allocated.

### 3f. Outbound fetch — LOW

`record-builder.ts` fetches only URLs returned by Brave Search
(`braveSearch()`), and `answerUnsourcedFigure` goes through the same `bank`
seam — **no operator- or model-supplied URL is fetched directly**, which is
the SSRF-relevant property and it holds. Each fetch has a 15 s
`AbortController` timeout (`lib/timeout.ts`). Gaps: no scheme check on the
Brave result URL (`new URL(url).protocol` is never inspected), and the body
is read whole (`res.text()` at `record-builder.ts:450, 590`) before being
truncated — a multi-hundred-MB HTML response is read into memory. Proposed:
`if (!/^https?:$/.test(new URL(r.url).protocol)) skip;` in the result
filter, and read the body through a `Response` with a byte cap (e.g. the
first 2 MB via `res.body.getReader()`).

`POST /op/library/import-video` (`routes.ts:710`) forwards an arbitrary
operator-typed `url` to the video Worker (`video-intake.ts:56`) with no
scheme check; that Worker is compartmentalised and out of scope, but a
`^https?://` test here costs nothing.

### 3g. `attachAuthState` and `resolveOperatorId` disagree about who the operator is — INFO

`/p/:slug` writes `last_opened_at` under the **cookie's** `uid`; every `/op`
route acts under the **oldest `users` row**. With one user they agree. With
`OPERATOR_EMAIL` empty (§1) a second Access-admitted email would get a
session for a new row while `/op` still acts as the first — a footgun, not
an exposure.

---

## 4. Checked and fine

- **Mutating routes and `user_id` (IDOR).** Every `SELECT/UPDATE/DELETE` in
  `operator/routes.ts` keyed by `:id` or a form id filters on
  `user_id = <operator>`: title accept/revert, reprocess, retry,
  research publish/discard/review/brief.md, readings create/delete/draft-essay,
  replace, delete (selected and all), draft-tetrad (`draft-tetrad.ts:102`),
  process advance/all/retry (`processing.ts`), research status
  (`deep-research.ts:1545+`), video import poll (`video-intake.ts:101`),
  `jobStatusForPiece` (`digest-jobs.ts:365`). `answer-lead.ts`,
  `answer-question.ts`, `lib/readings.ts`, `lib/resurface.ts` all filter on
  `user_id`. The one exception (2d) is fixed.
- **No GET under `/op` mutates.** `/op/research`, `/op/research-status`,
  `/op/feed/status`, `/op/…/brief.md`, `/op/notes.js`, `/op/chat.js`,
  `/op/login` are read-only. `/p/:slug`'s `last_opened_at` write is gated on
  `is_operator === true && operator_id` and filtered on `user_id = operator_id`.
- **SQL injection.** Every `${…}` inside a SQL string in the audited files is
  a `?` placeholder list, a table name from a hard-coded array, or one of the
  `OWN_UPLOADS_SQL` / `WEB_FETCHED_SQL` / `DEEP_RESEARCH_SQL` constants.
  `lib/d1.ts`'s `insertOne`/`updateOne` take the table and column names from
  code. `cms/routes/api-posts.ts:143` interpolates `field` from a hard-coded
  `editable` whitelist.
- **HTML escaping.** Every user- or model-controlled string in the new
  renderers goes through `escapeHtml`/`escapeAttr`: `?error=`, `?ingested=`,
  `?queued=`, `?video_error=` in the library banners; `?uploaded=` ids are
  only used to look rows up, never printed; the lead seeds, angles, slugs and
  ids in every dig form (`investigations.ts:618-623, 718-728`,
  `piece-template.ts:794-826`, `search.ts:180`); the search `?q=` in the
  input, summary, title (`layout.ts:72-73` escapes the `<title>`) and stored
  answer; the review panel (`research-workspace.ts`); the margin asides
  (`piece-template.ts:728-731`, note bodies via the escaping renderer; the
  marker characters are private-use code points that `escapeHtml` leaves
  alone and a UUID that never contains them); the retitle line; the lead
  answer's `a.error`. `markdown.ts` escapes the whole source first and
  whitelists link schemes to `http(s):`, `mailto:`, `/`, `#`.
- **Scripts on public pages.** Every `<script>` is either JSON-LD built with
  `JSON.stringify` and `</script` → `<\/script` (`machine.ts:392`), the
  analytics beacon with a token stripped to `[A-Za-z0-9_-]`
  (`layout.ts:151`), or an operator-only inline script included solely when
  `isOperator` (`/op/notes.js`, `PROCESS_LIVE_JS`, the dropzone, the status
  banner). None interpolates request data: the status banner and research
  live layer put the poll URL in a `data-` attribute via `escapeAttr` and
  build DOM with `textContent`; `notes-live.ts` reads `?error=` into
  `textContent`. `feed.json` is a JSON document, not a script.
- **Redirect targets.** `/op/leads/dig` redirects to
  `/library/${encodeURIComponent(piece_slug)}#leads` or `/op/research?q=…`
  — encoded, same-origin. `/op/readings` redirects to a slug read from the
  DB. `/op/library/:id/replace`, `/op/ask`, `/op/search/research` redirect
  to fixed paths with encoded query values. Only `return_to` and `next`
  were user-controlled paths, both now guarded (2b).
- **Session cookie.** HMAC-SHA256 via WebCrypto (`crypto.subtle.verify` is
  constant-time), `{uid, exp}` payload, 30-day expiry checked, cookie
  `HttpOnly; Secure; SameSite=Lax; Path=/`, domain `.canopticon.com` in
  production. `SESSION_SECRET` is only ever passed to `importKey`; it is
  never logged or echoed (the login diagnostic page names the variable, not
  the value). Logout clears with matching attributes.
- **Secrets in logs.** `index.ts`'s error handler persists `err.message` and
  a 4,000-char stack to `orchestrator_events` and `console.error`s the error;
  no env value is included. `indexnow.ts` logs status codes and URLs, not
  the key. Nothing logs headers.
- **IndexNow key route.** `/:key{[A-Za-z0-9-]{8,128}\.txt}` serves only the
  configured key and only when `asked === key`; the key is validated to the
  same charset on read (`indexnow.ts:31-33`). It cannot be used to read any
  other file.
- **`/v1/admin/*` and `CRON_SECRET`.** All three admin modules mount
  `requireAuth()` on `*`. There is no `CRON_SECRET` check anywhere in
  `src/` (the variable is referenced only in CLAUDE.md); the cron itself is
  off. Destructive admin endpoints require `?confirm=1` and, where the
  effect is irreversible, `&execute=1`.
- **Denial by button.** `/op/process/all`, `/op/ask`, `/op/leads/dig`,
  `/op/search/research`, `/op/pieces/:id/draft-tetrad`,
  `/op/readings/:id/draft-essay` are behind Access (§1). The pollers
  (`process-live.ts`, `status-banner.ts`, `research-live.ts`) are emitted
  only into pages rendered for the operator; an anonymous page carries no
  script that calls `/op/*`. A poller can only press what its own page's
  cookie/Access session can press, and each press is one bounded step.
- **`/confirm` and `/unsubscribe`.** Single-use UUID tokens, cleared on use;
  the row is looked up by token only, which is the right key. No enumeration
  (a bad token renders the same "not found" page).
- **`/library/:slug` and `/p/:slug.md`.** Both refuse `working-material`
  (`piece-template.ts:79`; the `.md` branch explicitly). Drafts have no
  public URL.
- **Readings and margin asides.** `createReading` stores the document's own
  bytes for the passage (`locateVerbatim`), never the submitted text; a
  reading's note is the operator's markdown rendered through the escaping
  renderer; delete removes the anchoring quote so no orphan `/q/` receipt
  survives.

---

## 5. Files changed

- `packages/api/src/operator/routes.ts` — review screen uses the escaping
  renderer (2a); `return_to` guard rejects `/\` (2b); video-status piece
  lookup filters on `user_id` (2d).
- `packages/api/src/auth/routes.ts` — `?next=` guard rejects `/\` (2b).
- `packages/api/src/public/routes.ts` — `/og/:file` name constrained (2c).
- `packages/api/tests/security-audit.test.ts` — new, 16 tests.
- `docs/SECURITY-AUDIT-2026-09-24.md` — this file.

Verified: `pnpm exec tsc --noEmit -p packages/api` clean; `biome check` clean
on the files above (`src/public/routes.ts` carries an unrelated
`organizeImports` error from a concurrent edit that adds
`import { searchModel } from "./models/search"` — not this audit's);
vitest green on `security-audit`, `login-mounts`, `research-review`,
`leads-dig`, `workbench-replace`, `public-site`, `auth-session`, `og-image`,
`research-run-walk`, `research-workspace` (96 tests).
