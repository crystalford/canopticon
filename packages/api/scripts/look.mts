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

const { env, ALL } = await import("./fixture.mts");

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
const origin = `http://127.0.0.1:${port}`;

const { mkdirSync } = await import("node:fs");
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || undefined,
});

const SHOTS: Array<[string, string, number]> = [
  ["front", "/", 1400],
  ["essays", "/essays", 1400],
  ["research", "/research", 1400],
  ["piece", "/p/the-logic-costume", 1400],
  // The research template WITH the provenance banner — a different code path
  // from the essay above, and the only page that renders that block at all.
  ["piece-auto", "/p/budget-2026-estimates", 1400],
  ["numbers", "/numbers", 1400],
  ["about", "/about", 1400],
  ["essays-mobile", "/essays", 390],
  ["piece-mobile", "/p/the-logic-costume", 390],
];

for (const [name, urlPath, width] of SHOTS) {
  const page = await browser.newPage({ viewport: { width, height: 1000 } });
  const errs: string[] = [];
  page.on("pageerror", (e) => errs.push(e.message));
  const resp = await page.goto(`${origin}${urlPath}`, { waitUntil: "networkidle" });
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
  console.log(
    `  ${name.padEnd(16)} ${String(resp?.status()).padEnd(4)} ${urlPath}` +
      `${errs.length ? `  ⚠ ${errs.join("; ")}` : ""}` +
      `${overflow ? `  ⚠ overflows ${overflow.page}>${overflow.view}px — widest: ${overflow.sel} @${overflow.right}` : ""}`,
  );
  await page.close();
}

await browser.close();
server.close();
console.log(`\nwrote ${SHOTS.length} screenshots to ${OUT}`);
