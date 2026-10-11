// CHECK EVERY RECEIPT LANDS — open each article, follow every receipt chip
// to its /p/<doc>#q= passage in a real browser, and count the ones the
// passage finder could not mark. A miss is a broken citation.
//
//   CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
//     pnpm tsx scripts/check-receipts.mts <article-slug> [...]
//   pnpm tsx scripts/check-receipts.mts $(ls content/articles | sed "s/\.md$//")
//
// Same posture as scripts/look.mts: playwright is not a dependency.

import http from "node:http";
import { chromium } from "playwright";
import app from "../src/index.ts";
const { env } = await import("./fixture.mts");
const server = http.createServer(async (req, res) => {
  const r = await app.fetch(new Request(`http://local${req.url}`), env);
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(Buffer.from(await r.arrayBuffer()));
});
await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
const port = (server.address() as { port: number }).port;
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
let ok = 0;
let miss = 0;
for (const slug of process.argv.slice(2)) {
  await p.goto(`http://127.0.0.1:${port}/articles/${slug}`);
  const hrefs = await p.evaluate(() =>
    [...document.querySelectorAll("a.rc")]
      .map((a) => a.getAttribute("href") ?? "")
      .filter((h) => h.includes("#q=")),
  );
  for (const h of hrefs) {
    await p.goto(`http://127.0.0.1:${port}${h}`);
    await p.waitForTimeout(150);
    const n = await p.evaluate(() => document.querySelectorAll("mark.hit").length);
    if (n) ok++;
    else {
      miss++;
      console.log("MISS", decodeURIComponent(h).slice(0, 200));
    }
  }
}
console.log({ ok, miss });
await b.close();
server.close();
