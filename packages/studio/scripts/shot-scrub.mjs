import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LAB = path.resolve(HERE, "..", "lab");
const { cut, film } = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".woff2": "font/woff2",
};
const server = http.createServer((req, res) => {
  const rel =
    decodeURIComponent((req.url || "/").split("?")[0]).replace(/^\/+/, "") || "index.html";
  const file = path.join(LAB, rel);
  if (!file.startsWith(LAB) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end("not found");
    return;
  }
  res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch({
  headless: true,
  executablePath: fs.existsSync(EXE) ? EXE : undefined,
});
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

await page.route("**/v1/**", (route) => {
  const url = new URL(route.request().url());
  const body =
    url.pathname === `/v1/film/${cut.filmId}`
      ? { film: { title: film.title, narration: film.narration }, editorial: "rules" }
      : url.pathname === `/v1/film/${cut.filmId}/cut`
        ? cut
        : url.pathname === "/v1/voices"
          ? { voices: [] }
          : null;
  if (body) route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
  else route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
});

await page.goto(`${origin}/index.html#film/${cut.filmId}`);
await page.waitForFunction(
  () => /beats/.test(document.querySelector("#sub")?.textContent ?? ""),
  null,
  {
    timeout: 15000,
  },
);

// seek to 40% so the fill/playhead are visibly mid-bar, not at the edge
const bar = await page.locator("#scrub").boundingBox();
await page.mouse.move(bar.x + bar.width * 0.4, bar.y + bar.height / 2);
await page.mouse.down();
await page.mouse.up();

await page.screenshot({ path: process.argv[3] || "/tmp/scrub-shot.png" });
console.log("wrote", process.argv[3] || "/tmp/scrub-shot.png");

await browser.close();
server.close();
