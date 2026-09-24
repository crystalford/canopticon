// LOOK — serve the real public site against a seeded in-memory D1 and
// screenshot it.
//
// There is no local dev server for this project (everything is verified on
// deploy), which made "does the redesign actually look right" a question you
// could only answer by merging. This answers it in about four seconds: the
// REAL Hono app, the REAL renderers, the REAL stylesheet, driven through
// app.fetch by a tiny proxy so /styles.css resolves like it does in prod.
//
//   pnpm add -D -w playwright          # not a repo dependency — see below
//   CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
//     pnpm tsx scripts/look.mts [outDir]
//
// Playwright is deliberately NOT in package.json: it would add a browser
// download to every CI install to serve a tool only a human looking at the
// output ever runs. packages/studio/scripts/look.mjs has the same shape and
// the same unlisted requirement. Point CHROMIUM_PATH at the Chromium already
// on the machine rather than running `playwright install`.
//
// It is a look-at-it tool, not a test. Assertions belong in tests/.

import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import app from "../src/index.ts";

const OUT = path.resolve(
  process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".look"),
);

const { env } = await import("./fixture.mts");

const server = http.createServer(async (req, res) => {
  try {
    // Headers must be forwarded, not dropped. They were, and the Cookie
    // header went with them — so an operator session could never reach the
    // app and every operator-only page photographed as its sign-in screen.
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (typeof v === "string") headers.set(k, v);
      else if (Array.isArray(v)) headers.set(k, v.join("; "));
    }
    const r = await app.fetch(new Request(`http://local${req.url ?? "/"}`, { headers }), env);
    res.writeHead(r.status, Object.fromEntries(r.headers));
    res.end(Buffer.from(await r.arrayBuffer()));
  } catch (e) {
    res.writeHead(500).end(String(e));
  }
});
await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
const port = (server.address() as { port: number }).port;
const origin = `http://127.0.0.1:${port}`;

const { mkdirSync } = await import("node:fs");
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || undefined,
});

const RESEARCH_Q = "What is the genuine white space in ad-serving and attribution?";
const RESEARCH_URL = `/op/research?q=${encodeURIComponent(RESEARCH_Q)}`;
const { REVIEW_LABEL } = await import("./fixture.mts");
const REVIEW_URL = `/op/research?q=${encodeURIComponent(REVIEW_LABEL)}`;

// The fourth slot: "operator" signs the request in; "optional" means the route
// may not exist yet (another branch's work) — a 404 is logged and skipped, it
// never fails the run.
const SHOTS: Array<[string, string, number, ("operator" | "optional")?]> = [
  ["front", "/", 1400],
  // Search results, the one index whose rows are assembled by query rather
  // than listed, and the page most likely to be reached from a citation.
  ["search", "/search?q=housing", 1400],
  // The hub, if the route has landed on this tree. Optional: see above.
  ["hub", "/hub", 1400, "optional"],
  ["essays", "/essays", 1400],
  ["research", "/research", 1400],
  ["piece", "/p/the-logic-costume", 1400],
  // The research template WITH the provenance banner — a different code path
  // from the essay above, and the only page that renders that block at all.
  ["piece-auto", "/p/budget-2026-estimates", 1400],
  ["about", "/about", 1400],
  ["essays-mobile", "/essays", 390],
  // THE SAME DOCUMENT, SIGNED IN: the action bar, the note form's script, and
  // the operator's readings with their delete/draft buttons in the margin.
  // The anonymous shot above proves the margin note renders for a reader;
  // this one proves the operator's affordances sit beside it without
  // breaking the column.
  ["piece-operator", "/p/the-logic-costume", 1400, "operator"],
  ["piece-mobile", "/p/the-logic-costume", 390],
  // A research document on a phone. The essay above does not cover it: a
  // research body carries a wide pipe table, and a table is the one construct
  // that can push a whole page sideways. The overflow check below is what
  // actually catches that, and it needs a page with a table on it to check.
  ["research-mobile", "/p/budget-2026-estimates", 390],
  // THE RESEARCH WORKSPACE, mid-run: two of the plan's searches done, sources
  // landing, one still being fetched. Operator-only, and the one screen where
  // "is this working?" is the whole question — so it has to be looked at.
  ["research-workspace", RESEARCH_URL, 1400, "operator"],
  ["research-workspace-mobile", RESEARCH_URL, 390, "operator"],
  // THE REVIEW: a finished run, its brief read on the workspace before it is
  // published — the parent it grew from, the sections with one killed quote
  // in red, the body, the gaps, Publish and Download. The state that closes
  // the loop, and the one a "draft ready" headline used to hide.
  ["research-review", REVIEW_URL, 1400, "operator"],
  // OPERATOR-ONLY. /library is where documents are uploaded and where the
  // ingestion receipt renders, and it 401s without a session — so until now
  // the only thing this tool could photograph was the signed-out page. An
  // operator surface nobody can see is an operator surface nobody checks.
  ["library", "/library", 1400, "operator"],
  ["library-mobile", "/library", 390, "operator"],
  // JUST UPLOADED: the banner /op/feed/upload's redirect opens the page on —
  // one processed row (consolidation line and leads) and one still queued.
  [
    "library-uploaded",
    "/library?uploaded=budget-2026-estimates,transfer-payments-2025",
    1400,
    "operator",
  ],
];

// A signed operator cookie, so the operator shots above render the real
// working surface rather than the sign-in page.
const { signSession, buildSessionCookie } = await import("../src/auth/session.ts");
const { SESSION_SECRET } = await import("./fixture.mts");
const opCookie = buildSessionCookie(
  await signSession({ uid: "u1", exp: Math.floor(Date.now() / 1000) + 3600 }, SESSION_SECRET),
).split(";")[0] as string;
const [opName, opValue] = opCookie.split("=") as [string, string];

for (const [name, urlPath, width, as] of SHOTS) {
  const page = await browser.newPage({ viewport: { width, height: 1000 } });
  if (as === "operator") {
    await page
      .context()
      .addCookies([{ name: opName, value: opValue, domain: "127.0.0.1", path: "/" }]);
  }
  const errs: string[] = [];
  page.on("pageerror", (e) => errs.push(e.message));
  // "load", not "networkidle". The research workspace polls its own status
  // endpoint, so network idle never arrives and the shot times out — a live
  // page is not a broken one. A short settle instead gives the poller time to
  // paint its first frame without waiting for silence that will not come.
  const resp = await page.goto(`${origin}${urlPath}`, { waitUntil: "load" });
  if (as === "optional" && resp?.status() === 404) {
    console.log(
      `  ${name.padEnd(16)} 404  ${urlPath}  (optional route not mounted here — skipped)`,
    );
    await page.close();
    continue;
  }
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
  // Horizontal overflow is the one layout bug a screenshot hides: the page
  // looks fine and the reader gets a sideways scrollbar. Report the widest
  // offending element rather than just the fact of it.
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    if (doc.scrollWidth <= doc.clientWidth) return null;
    let worst = { sel: "", right: 0 };
    for (const el of Array.from(document.querySelectorAll("*"))) {
      const r = el.getBoundingClientRect();
      if (r.right > worst.right) {
        worst = {
          sel: `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? `.${el.className.trim().split(/\s+/).join(".")}` : ""}`,
          right: Math.round(r.right),
        };
      }
    }
    return { page: doc.scrollWidth, view: doc.clientWidth, ...worst };
  });
  // The SEO audits Lighthouse would run, on public pages only (the operator
  // console is behind Access and indexes nothing): a title, a description,
  // a canonical, a lang, exactly one h1, alt on every image, and JSON-LD on
  // a document page. Lighthouse itself is not installable in the sandbox;
  // these are the checks of its SEO category that a static render can fail.
  const audit =
    as === "operator"
      ? []
      : await page.evaluate((isPiece: boolean) => {
          // No inner function declarations: esbuild's keep-names helper
          // (__name) does not exist inside the page.
          const out: string[] = [];
          const d = document;
          if (!d.title.trim()) out.push("no <title>");
          if (!d.querySelector('meta[name="description"]')?.getAttribute("content")?.trim())
            out.push("no meta description");
          if (!d.querySelector('link[rel="canonical"]')?.getAttribute("href"))
            out.push("no canonical");
          if (!document.documentElement.lang) out.push("no <html lang>");
          const h1 = document.querySelectorAll("h1").length;
          if (h1 !== 1) out.push(`${h1} <h1>`);
          const noAlt = Array.from(document.images).filter((i) => !i.hasAttribute("alt")).length;
          if (noAlt) out.push(`${noAlt} <img> without alt`);
          if (isPiece && !d.querySelector('script[type="application/ld+json"]'))
            out.push("no JSON-LD");
          return out;
        }, urlPath.startsWith("/p/"));
  console.log(
    `  ${name.padEnd(16)} ${String(resp?.status()).padEnd(4)} ${urlPath}` +
      `${errs.length ? `  ⚠ ${errs.join("; ")}` : ""}` +
      `${overflow ? `  ⚠ overflows ${overflow.page}>${overflow.view}px — widest: ${overflow.sel} @${overflow.right}` : ""}` +
      `${audit.length ? `  ⚠ seo: ${audit.join(", ")}` : ""}`,
  );
  await page.close();
}

await browser.close();
server.close();
console.log(`\nwrote ${SHOTS.length} screenshots to ${OUT}`);
