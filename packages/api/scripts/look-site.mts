// LOOK AT THE BLACK BOX SITE — serve the real app against the seeded fixture
// and screenshot the given paths at the given widths.
//
//   CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
//     pnpm tsx scripts/look-site.mts <outDir> <width> <path> [path…]
//
// Each path may carry "@y:height" to clip, e.g. "/library@0:1400".
// Same posture as scripts/look.mts: playwright is not a dependency.

import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";
import app from "../src/index.ts";

const [outDir = ".look", width = "1280", ...paths] = process.argv.slice(2);
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
const page = await browser.newPage({ viewport: { width: Number(width), height: 900 } });
if (process.env.OFFLINE_HELPER) {
  const { offline } = await import(process.env.OFFLINE_HELPER);
  await offline(page);
}
page.on("pageerror", (e) => console.log("pageerror", String(e).slice(0, 200)));
for (const spec of paths) {
  const [p = "/", clip] = spec.split("@");
  await page.goto(`http://127.0.0.1:${port}${p}`);
  await page.waitForTimeout(700);
  const name = `${p.replace(/[^a-z0-9]+/gi, "_").slice(0, 60) || "root"}-${width}${clip ? `-${clip.replace(":", "_")}` : ""}.png`;
  const file = path.join(outDir, name);
  if (clip) {
    const [y = "0", h = "1400"] = clip.split(":");
    await page.screenshot({
      path: file,
      fullPage: true,
      clip: { x: 0, y: Number(y), width: Number(width), height: Number(h) },
    });
  } else await page.screenshot({ path: file, fullPage: true });
  console.log(file);
}
await browser.close();
server.close();
