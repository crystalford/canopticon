// Operator routes. Mounted at /op in the Worker root. Cloudflare Access
// gates this subtree at the edge; /op/login mints the session cookie.
//
// The operator has no separate console: /library (public/render/
// investigations.ts) is the working page, and these are the POST actions its
// buttons submit to, plus the research workspace at /op/research. The
// graph-era screens (outputs, studio, synthesis, signed readings, proposals,
// faces) were unmounted on 2026-09-24 — see docs/the-record.md §9. Their
// old paths 301 to the live surfaces at the bottom of this file.
//
// Split by concern on 2026-09-24 (no handler changed): the modules under
// operator/routes/ each build their own sub-app on the shared type in
// routes/app.ts, and this file mounts them at "/" so every path is what it
// was. `createAndExtract` now lives in routes/upload.ts.

import { operatorApp } from "./routes/app";
import exportRoutes from "./routes/export";
import leadsRoutes from "./routes/leads";
import processingRoutes from "./routes/processing";
import readingsRoutes from "./routes/readings";
import researchRoutes from "./routes/research";
import sessionRoutes from "./routes/session";
import uploadRoutes from "./routes/upload";

const app = operatorApp();

// ---- one site, permission layers (spec v2.5 Part 9) ---------------------
//
// PR 1 dissolves the /op/* console as a destination. The operator now lives
// on the public URLs; /auth/login mints a session cookie, public renderers
// surface operator affordances inline. These GET redirects bounce the old
// console URLs to their public equivalents so external links keep working.
//
// POST endpoints below (extract, sign, edit, discard, etc.) are the ACTION
// endpoints the public-side affordances post to — those stay mounted. Only
// the GET screens (which rendered the dark-themed parallel console) redirect.
const OP_GET_REDIRECTS: Array<[string, string]> = [
  ["/", "/"],
  ["/out", "/"],
  ["/synthesis", "/"],
  ["/studio", "/"],
  ["/outputs", "/research"],
  // The operator console moved from /library (now the public Library) to
  // /desk; /op/library is where upload and the action endpoints land.
  ["/library", "/desk"],
  ["/desk", "/desk"],
];
for (const [from, to] of OP_GET_REDIRECTS) {
  app.get(from, (c) => {
    const qs = new URL(c.req.url).search;
    return c.redirect(`${to}${qs}`, 302);
  });
}

// The action endpoints, by concern. Mounted in the order the handlers used to
// appear in this file; no two modules register the same method + path.
app.route("/", sessionRoutes);
app.route("/", uploadRoutes);
app.route("/", researchRoutes);
app.route("/", processingRoutes);
app.route("/", leadsRoutes);
app.route("/", exportRoutes);
app.route("/", readingsRoutes);

// ---- 301 redirects from old screen paths -------------------------------
// Bookmarks and chat-history references keep working. Each pre-P0 screen
// maps to the new surface that absorbed its functionality.

const redirects: Record<string, string> = {
  "/console": "/desk",
  "/ingest": "/desk",
  "/workbench": "/desk",
  "/leads": "/desk",
  "/patterns": "/research",
  "/editorial": "/desk",
  "/build": "/desk",
  "/publish": "/desk",
  "/briefs": "/research",
  // Unmounted 2026-09-24 (docs/the-record.md §9).
  "/out": "/",
  "/synthesis": "/desk",
  "/studio": "/",
  "/outputs": "/research",
  "/records": "/research",
  "/proposals": "/research",
  "/faces": "/",
  "/answers": "/desk",
};

for (const [from, to] of Object.entries(redirects)) {
  app.get(from, (c) => c.redirect(to, 301));
  app.get(`${from}/:rest{.*}`, (c) => c.redirect(to, 301));
}

export default app;
