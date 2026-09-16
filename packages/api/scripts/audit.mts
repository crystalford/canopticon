// AUDIT — walk every page a person can reach and report what they find.
//
// This exists because the operator kept having to be the QA loop: open the
// site, discover something thin or unreachable, and come back and report it.
// That is not their job. look.mts renders pages, but only the handful you
// point it at, so it only ever confirmed the page you had just changed.
//
// This walks the whole surface instead and says, for each route: does it
// resolve, how much did a reader actually get, is it announced anywhere, and
// does it render an empty state. No screenshots — this is the inventory pass
// that tells you WHICH pages are worth looking at.
//
//   pnpm tsx scripts/audit.mts
//
// A look-at-it tool like look.mts, not a test. Assertions belong in tests/.

import http from "node:http";
import app from "../src/index.ts";
import { PRIMARY_NAV } from "../src/public/layout.ts";

// Same seeded in-memory D1 as look.mts, imported rather than duplicated so
// the two tools cannot disagree about what the fixture contains.
const { env, FIXTURE } = await import("./fixture.mts");

/** Every no-parameter public route, plus detail pages on fixture slugs. */
const ROUTES: string[] = [
  "/",
  "/essays",
  "/research",
  "/about",
  "/method",
  "/library",
  "/search",
  "/activity",
  "/citations",
  "/how-it-works",
  "/instruments",
  "/investigations",
  "/topics",
  "/videos",
  "/watchlist",
  "/bulk-expand",
  `/p/${FIXTURE.essaySlug}`,
  `/p/${FIXTURE.researchSlug}`,
  `/library/${FIXTURE.researchSlug}`,
];

const server = http.createServer(async (req, res) => {
  try {
    const r = await app.fetch(new Request(`http://local${req.url ?? "/"}`), env);
    res.writeHead(r.status, Object.fromEntries(r.headers));
    res.end(Buffer.from(await r.arrayBuffer()));
  } catch (e) {
    res.writeHead(500).end(String(e));
  }
});
await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
const port = (server.address() as { port: number }).port;

const navHrefs = new Set(PRIMARY_NAV.map((n) => n.href));

/** Roughly what a reader gets: tags and script stripped, whitespace collapsed. */
function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The chrome every page carries, so "content" means content. */
let chromeChars = 0;

const rows: Array<{
  route: string;
  status: number;
  content: number;
  announced: string;
  note: string;
}> = [];

for (const route of ROUTES) {
  const res = await fetch(`http://127.0.0.1:${port}${route}`, { redirect: "manual" });
  const html = res.status === 200 ? await res.text() : "";
  const text = visibleText(html);
  // The About page is the smallest fully-intentional page; anything much
  // under it is suspect rather than merely short.
  if (route === "/about") chromeChars = 0;
  const empty = /No .{0,40}(yet|published)|Nothing here yet|not found/i.test(text);
  rows.push({
    route,
    status: res.status,
    content: Math.max(0, text.length - chromeChars),
    announced: navHrefs.has(route) ? "nav" : html.includes(`href="${route}"`) ? "self" : "—",
    note:
      res.status !== 200 ? `→ ${res.headers.get("location") ?? ""}` : empty ? "EMPTY STATE" : "",
  });
}

// ---- Can a reader STUMBLE into a dead end? -------------------------------
//
// "Not in the nav" is not the same as "unreachable". What matters is whether
// clicking from the front door lands you somewhere empty — that is the thing
// the operator kept hitting, and a route list alone does not show it.
const seen = new Set<string>(["/"]);
const queue = ["/", ...PRIMARY_NAV.map((n) => n.href)];
const reachable = new Map<string, string>(); // route -> first page that linked it
while (queue.length) {
  const from = queue.shift() as string;
  if (!from.startsWith("/") || from.includes(".")) continue;
  const r = await fetch(`http://127.0.0.1:${port}${from}`, { redirect: "manual" });
  if (r.status !== 200) continue;
  const html = await r.text();
  for (const m of html.matchAll(/href="(\/[^"#?]*)"/g)) {
    const href = (m[1] as string).replace(/\/$/, "") || "/";
    if (seen.has(href) || href.startsWith("/auth")) continue;
    seen.add(href);
    reachable.set(href, from);
    queue.push(href);
  }
}

const deadEnds: Array<[string, string, number]> = [];
for (const [route, from] of reachable) {
  const r = await fetch(`http://127.0.0.1:${port}${route}`, { redirect: "manual" });
  if (r.status !== 200) continue;
  const html = await r.text();
  const text = visibleText(html);
  const isEmpty = /No .{0,40}(yet|published)|Nothing here yet/i.test(text);
  // Empty is fine; empty with nowhere to go is the bug. An empty state that
  // names the next step is a signpost, so only a full stop counts.
  const emptyBlock = html.match(/<div class="card soft"[\s\S]*?<\/div>/)?.[0] ?? "";
  const hasOnward = emptyBlock.includes("<a href");
  if (isEmpty && !hasOnward) deadEnds.push([route, from, text.length]);
}

server.close();

const pad = (s: string | number, n: number) => String(s).padEnd(n);
console.log(`\n${pad("route", 34)}${pad("status", 8)}${pad("chars", 8)}${pad("in nav", 8)}note`);
console.log("-".repeat(78));
for (const r of rows.sort((a, b) => a.content - b.content)) {
  console.log(
    `${pad(r.route, 34)}${pad(r.status, 8)}${pad(r.content, 8)}${pad(r.announced, 8)}${r.note}`,
  );
}

const thin = rows.filter((r) => r.status === 200 && r.content < 900);
const unreachable = rows.filter((r) => r.status === 200 && r.announced === "—");
console.log(`\n${thin.length} page(s) under 900 chars of text:`);
for (const r of thin) console.log(`  ${r.route}  (${r.content})`);
console.log(`\n${unreachable.length} page(s) resolving but linked from nowhere in the nav.`);

console.log(`\n${reachable.size} route(s) reachable by clicking from the nav.`);
if (deadEnds.length) {
  console.log(`\n${deadEnds.length} DEAD END(S) — reachable by clicking, and empty:`);
  for (const [route, from, n] of deadEnds)
    console.log(`  ${route}  (${n} chars) ← linked from ${from}`);
} else {
  console.log("\nNo reachable dead ends.");
}
