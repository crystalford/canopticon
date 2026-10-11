// CHECK AGAINST THE HANDOFF — render each prototype page from the design
// handoff beside the page we built for it, and list what a reader of the
// prototype would see or use that ours does not have.
//
// Why this exists: a handoff's written docs and its pages disagree in small
// ways, and the docs are easy to follow by mistake. The README said "Desk" and
// /desk; the prototype page said "Admin". The README's own rule is that the
// page wins. A screenshot comparison misses a renamed link or a dropped label;
// this does not. Compared per page:
//
//   headings    every h1–h3
//   controls    button text, field placeholders, labels
//   links       every link's text, and where it goes (prototype file names
//               mapped to production routes — ROUTES.md)
//   labels      short text a reader sees (pills, captions, section names)
//
// Usage — serve the handoff folder first (it is not in the repo):
//   python3 -m http.server 8765 --directory <handoff>/design_handoff_black_box
//   CHROMIUM_PATH=… HANDOFF=<handoff>/design_handoff_black_box \
//     pnpm tsx scripts/check-against-handoff.mts [outFile.md]
//
// The prototype pages load React from a CDN; set OFFLINE_HELPER to a module
// exporting offline(page) where the browser has no network. Same posture as
// scripts/look.mts: playwright is not a dependency.

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";
import app from "../src/index.ts";

const HANDOFF = process.env.HANDOFF ?? "";
const PROTO = process.env.PROTO_BASE ?? "http://127.0.0.1:8765/pages/";
const OUT = process.argv[2] ?? "handoff-check.md";
const CONTENT = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "content");

// ---- prototype file names → production routes (ROUTES.md) ------------------

const fileRoute = new Map<string, string>();
for (const r of JSON.parse(readFileSync(path.join(CONTENT, "library.json"), "utf8")) as Array<{
  href?: string;
  route: string;
}>) {
  const h = decodeURIComponent(r.href ?? "");
  if (h && !h.includes("?")) fileRoute.set(h, r.route);
}
for (const dir of ["articles", "papers"]) {
  for (const f of readdirSync(path.join(CONTENT, dir))) {
    const m = /^file: "([^"]+)"/m.exec(readFileSync(path.join(CONTENT, dir, f), "utf8"));
    if (m?.[1]) fileRoute.set(m[1], `/articles/${f.replace(/\.md$/, "")}`);
  }
}
const FIXED: Record<string, string> = {
  "Canopticon Front.dc.html": "/",
  "Canopticon Method.dc.html": "/about",
  "Canopticon Search.dc.html": "/search",
  "Canopticon Follow.dc.html": "/follow",
  "Canopticon Ideas.dc.html": "/ideas",
  "Canopticon Investigations.dc.html": "/investigations",
  "Canopticon Concept.dc.html": "/concepts/self-extinguishing-maintenance",
  "Canopticon Concept CPAI.dc.html": "/concepts/cpai",
  "Canopticon Concept Overhearer.dc.html": "/concepts/the-overhearer",
  "Canopticon Open Whey.dc.html": "/open/hot-coffee-whey",
  "Canopticon Admin.dc.html": "/admin",
  "Canopticon Library.dc.html": "/library",
  "Canopticon Aldershot.dc.html": "/admin/projects/aldershot",
  "Canopticon Collection.dc.html": "/admin/projects/ancaster",
};
const slug = (t: string) =>
  t
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export function protoRoute(href: string): string {
  if (/^(https?:|mailto:|#)/.test(href) || !href.includes(".dc.html")) {
    return (
      { "feed.xml": "/feed.xml", "feed.json": "/feed.json", "llms.txt": "/llms.txt" }[href] ?? href
    );
  }
  const file = href.split("/").pop() ?? href;
  const [base0 = "", frag = ""] = file.split("#");
  const [base1 = "", qs = ""] = base0.split("?");
  const base = decodeURIComponent(base1);
  const q = new URLSearchParams(qs);
  const hash = frag ? `#${frag.split(":~:")[0]?.replace(/^q=.*/, "q=…")}` : "";
  if (base === "Canopticon Doc.dc.html") return `/p/${q.get("d") ?? ""}${hash}`;
  if (base === "Canopticon Term.dc.html") return `/concepts/${q.get("p") ?? ""}${hash}`;
  if (base === "Canopticon Problem.dc.html") return `/open/${q.get("p") ?? ""}${hash}`;
  if (base === "Canopticon Topic.dc.html")
    return `/topics/${slug(q.get("topic") ?? q.get("t") ?? "")}`;
  if (base === "Canopticon Library.dc.html") {
    const parts: string[] = [];
    if (q.get("k")) parts.push(`kind=${q.get("k")}`);
    if (q.get("topic")) parts.push(`topic=${slug(q.get("topic") ?? "")}`);
    return `/library${parts.length ? `?${parts.join("&")}` : ""}${hash}`;
  }
  if (base === "Canopticon Follow.dc.html" && q.get("topic"))
    return `/follow?topic=${q.get("topic")}`;
  return (FIXED[base] ?? fileRoute.get(base) ?? `?? ${base}`) + hash;
}

/** Our hrefs, comparable with the mapped prototype ones. */
function ourRoute(href: string): string {
  // Only our own origin is stripped; an external link keeps its host.
  const u = href.replace(/^https?:\/\/(127\.0\.0\.1(:\d+)?|local)(?=\/)/, "");
  const [p = "", frag = ""] = u.split("#");
  const decoded = decodeURIComponent(p).replace(/&amp;/g, "&");
  return frag ? `${decoded}#${frag.split(":~:")[0]?.replace(/^q=.*/, "q=…")}` : decoded;
}

// ---- the pairs ----------------------------------------------------------------

const PAIRS: Array<[string, string]> = [
  ["Front", "/"],
  ["Library", "/library"],
  ["Topic?topic=Housing", "/topics/housing"],
  [
    "Doc?d=did-banning-airbnb-actually-fix-canadian-housing-evidence-based-audit",
    "/p/did-banning-airbnb-actually-fix-canadian-housing-evidence-based-audit",
  ],
  ["Term?p=the-price-as-instruction", "/concepts/the-price-as-instruction"],
  [
    "Problem?p=does-talking-to-an-ai-change-how-you-think",
    "/open/does-talking-to-an-ai-change-how-you-think",
  ],
  ["Concept", "/concepts/self-extinguishing-maintenance"],
  ["Concept CPAI", "/concepts/cpai"],
  ["Concept Overhearer", "/concepts/the-overhearer"],
  ["Open Whey", "/open/hot-coffee-whey"],
  ["Ideas", "/ideas"],
  ["Investigations", "/investigations"],
  ["Search?find=rent", "/search?q=rent"],
  ["Method", "/about"],
  ["Follow", "/follow"],
  ["Admin", "/admin"],
];
for (const [file, route] of fileRoute) {
  if (/Essay|Paper/.test(file) && route.startsWith("/articles/")) {
    PAIRS.push([file.replace(/^Canopticon /, "").replace(/\.dc\.html$/, ""), route]);
  }
}

// ---- extraction ----------------------------------------------------------------

interface Inventory {
  headings: string[];
  controls: string[];
  links: Array<{ text: string; href: string }>;
  labels: string[];
}

// Passed as source text, not a function: tsx's transform adds a helper to
// functions that does not exist inside the page.
const EXTRACT = `(() => {
  const clean = (s) => (s || "").replace(/\\s+/g, " ").trim();
  const visible = (e) => {
    const r = e.getBoundingClientRect();
    const st = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && st.visibility !== "hidden" && st.display !== "none";
  };
  const all = [...document.querySelectorAll("body *")].filter(visible);
  return {
    headings: all.filter((e) => /^H[1-3]$/.test(e.tagName)).map((e) => clean(e.innerText)),
    controls: [
      ...all.filter((e) => e.tagName === "BUTTON" || e.tagName === "LABEL").map((e) => clean(e.innerText)),
      ...all.map((e) => e.getAttribute("placeholder") || "").filter(Boolean),
    ].filter(Boolean),
    links: all
      .filter((e) => e.tagName === "A" && e.getAttribute("href"))
      .map((e) => ({ text: clean(e.innerText), href: e.getAttribute("href") || "" }))
      .filter((l) => l.text),
    labels: all
      .filter((e) => e.children.length === 0)
      .map((e) => clean(e.innerText))
      .filter((t) => t.length > 1 && t.length <= 60 && !/^[\\d\\s.,:%$·–—-]+$/.test(t)),
  };
})()`;

async function inventory(page: import("playwright").Page): Promise<Inventory> {
  return (await page.evaluate(EXTRACT)) as Inventory;
}

// A leading section number ("5The gut check", "1 Feeling better") is layout,
// not wording: ours puts it inside the link or heading, the prototype beside.
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/^\d+\s*/, "");

// ---- run ----------------------------------------------------------------------

const { env, SESSION_SECRET } = await import("./fixture.mts");
const server = http.createServer(async (req, res) => {
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
  const r = await app.fetch(new Request(`http://local${req.url ?? "/"}`, { headers }), env);
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(Buffer.from(await r.arrayBuffer()));
});
await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
const ours = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
// Signed in on our side, as the prototypes render (they show the Admin pill).
const { signSession, buildSessionCookie } = await import("../src/auth/session.ts");
const cookie = buildSessionCookie(
  await signSession({ uid: "u1", exp: Math.floor(Date.now() / 1000) + 3600 }, SESSION_SECRET),
).split(";")[0] as string;
const [cn, cv] = cookie.split("=") as [string, string];
await ctx.addCookies([{ name: cn, value: cv, domain: "127.0.0.1", path: "/" }]);
const page = await ctx.newPage();
if (process.env.OFFLINE_HELPER) {
  const { offline } = await import(process.env.OFFLINE_HELPER);
  await offline(page);
}

const report: string[] = [
  "# Prototype vs build",
  "",
  "Each section lists what the prototype page shows that the built page does not. Generated by scripts/check-against-handoff.mts.",
  "",
];
let total = 0;
for (const [proto, route] of PAIRS) {
  const [name = "", qs = ""] = proto.split("?");
  await page.goto(
    `${PROTO}${encodeURIComponent(`Canopticon ${name}.dc.html`)}${qs ? `?${qs}` : ""}`,
  );
  await page.waitForTimeout(2500);
  const P = await inventory(page);
  await page.goto(`${ours}${route}`);
  await page.waitForTimeout(400);
  const O = await inventory(page);

  const has = (list: string[], t: string) => list.some((x) => norm(x) === norm(t));
  const lines: string[] = [];
  for (const h of new Set(P.headings))
    if (h && !has(O.headings, h)) lines.push(`- heading missing: “${h}”`);
  for (const c of new Set(P.controls))
    if (!has(O.controls, c) && !has(O.labels, c)) lines.push(`- control missing: “${c}”`);
  const seen = new Set<string>();
  for (const l of P.links) {
    const key = `${norm(l.text)}|${protoRoute(l.href)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const want = protoRoute(l.href);
    const same = O.links.filter((o) => norm(o.text) === norm(l.text));
    if (!same.length) lines.push(`- link missing: “${l.text.slice(0, 70)}” → ${want}`);
    else if (!same.some((o) => ourRoute(o.href) === want)) {
      lines.push(
        `- link goes elsewhere: “${l.text.slice(0, 70)}” → prototype ${want} · ours ${same.map((o) => ourRoute(o.href)).join(", ")}`,
      );
    }
  }
  for (const t of new Set(P.labels)) {
    if (
      !has(O.labels, t) &&
      !has(O.headings, t) &&
      !O.links.some((o) => norm(o.text).includes(norm(t)))
    ) {
      lines.push(`- text missing: “${t}”`);
    }
  }
  total += lines.length;
  report.push(`## ${proto} → ${route}`, "", ...(lines.length ? lines : ["Nothing missing."]), "");
  console.log(`${String(lines.length).padStart(4)}  ${proto} → ${route}`);
}
writeFileSync(OUT, report.join("\n"));
console.log(`${total} differences → ${OUT}`);
await browser.close();
server.close();
void HANDOFF;
