import fs from "node:fs";
const { chromium } = await import("playwright-core");
const dir = process.argv[2];
const files = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith(".png"))
  .sort();
const b = await chromium.launch({
  headless: true,
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const pg = await b.newPage();
await pg.setContent("<canvas id=c></canvas>");
const rows = [];
for (const f of files) {
  const data = fs.readFileSync(`${dir}/${f}`).toString("base64");
  const r = await pg.evaluate(async (d) => {
    const img = new Image();
    img.src = "data:image/png;base64," + d;
    await img.decode();
    const c = document.getElementById("c");
    c.width = img.width;
    c.height = img.height;
    const x = c.getContext("2d");
    x.drawImage(img, 0, 0);
    const p = x.getImageData(0, 0, c.width, c.height).data;
    let dark = 0,
      light = 0,
      mid = 0,
      edges = 0;
    const w = c.width;
    for (let i = 0; i < p.length; i += 4) {
      const v = p[i];
      if (v < 64) dark++;
      else if (v > 192) light++;
      else mid++;
      if (i > w * 4 && Math.abs(v - p[i - 4]) > 90) edges++;
    }
    const n = p.length / 4;
    return { dark: dark / n, light: light / n, mid: mid / n, edges: edges / n };
  }, data);
  rows.push([f, r]);
}
await b.close();
const fmt = (n) => (n * 100).toFixed(1).padStart(5);
console.log("frame            dark% light%  mid%  edge%");
for (const [f, r] of rows)
  console.log(f.padEnd(16), fmt(r.dark), fmt(r.light), fmt(r.mid), fmt(r.edges));
const mids = rows.map((r) => r[1].mid);
console.log(
  "\nMIDTONE range across every frame:",
  (Math.min(...mids) * 100).toFixed(1) + "% .. " + (Math.max(...mids) * 100).toFixed(1) + "%",
);
