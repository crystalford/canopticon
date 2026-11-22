// PRINT PAGES OF THE SITE TO PDF — for depositing a theory or paper in an
// archive that issues DOIs (Zenodo). Serves the real app against the seeded
// fixture, as look-site does, and prints each path with the site's own print
// styles, the canonical address in the footer of every page.
//
//   pnpm tsx scripts/print-site.mts <outDir> <path> [path…]
//
// Playwright is not a dependency; this uses the Chromium already installed.

import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";
import app from "../src/index.ts";

const [outDir = ".print", ...paths] = process.argv.slice(2);
const { env } = await import("./fixture.mts");
const server = http.createServer(async (req, res) => {
  try {
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
    const r = await app.fetch(new Request(`http://local${req.url ?? "/"}`, { headers }), env);
    res.writeHead(r.status, Object.fromEntries(r.headers));
    res.end(Buffer.from(await r.arrayBuffer()));
  } catch (e) {
    res.writeHead(500).end(String(e));
  }
});
await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
const port = (server.address() as { port: number }).port;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });
for (const p of paths) {
  await page.goto(`http://127.0.0.1:${port}${p}`);
  await page.waitForTimeout(500);
  const file = path.join(outDir, `${p.split("/").filter(Boolean).pop() ?? "page"}.pdf`);
  const where = `canopticon.com${p}`;
  await page.pdf({
    path: file,
    format: "A4",
    printBackground: true,
    margin: { top: "18mm", bottom: "18mm", left: "16mm", right: "16mm" },
    displayHeaderFooter: true,
    headerTemplate: "<span></span>",
    footerTemplate: `<div style="font:8px sans-serif;color:#777;width:100%;padding:0 16mm;display:flex;justify-content:space-between"><span>${where}</span><span>CC BY 4.0 · page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
  });
  console.log(file);
}
await browser.close();
server.close();
