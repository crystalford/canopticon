// THE CLAUDE DESIGN HANDOFF — screenshots of every surface built since the
// prototype (docs/blackbox/SINCE-PROTOTYPE.md lists them), from the seeded
// fixture, at desktop and phone widths, signed in where it matters.
//
//   CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
//     pnpm tsx scripts/look-handoff.mts <outDir> [01,02,…]
//
// Same posture as look-site.mts: playwright is not a dependency.
import http from "node:http";
import { type Page, chromium } from "playwright";
import app from "../src/index.ts";
const { env, SESSION_SECRET } = await import("./fixture.mts");
const { signSession, buildSessionCookie } = await import("../src/auth/session.ts");
const OUT = process.argv[2] as string;
const server = http.createServer(async (req, res) => {
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
  const r = await app.fetch(new Request(`http://local${req.url ?? "/"}`, { headers }), env);
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(Buffer.from(await r.arrayBuffer()));
});
await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const cookie = buildSessionCookie(
  await signSession({ uid: "u1", exp: Math.floor(Date.now() / 1000) + 3600 }, SESSION_SECRET),
).split(";")[0] as string;
const [name, value] = cookie.split("=") as [string, string];
async function ctx(width: number, height: number, signed: boolean) {
  const c = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  if (signed) await c.addCookies([{ name, value, domain: "127.0.0.1", path: "/" }]);
  return c.newPage();
}
const WHEY = "instant-dissolving-whey-for-hot-coffee-where-the-science-and-manufactu";
type Shot = {
  file: string;
  path: string;
  w?: number;
  h?: number;
  signed?: boolean;
  full?: boolean;
  maxH?: number;
  at?: string;
  act?: (p: Page) => Promise<void>;
};
const shots: Shot[] = [
  { file: "01-admin.png", path: "/admin", signed: true, full: true, maxH: 1700 },
  { file: "02-admin-claude.png", path: "/admin/claude", signed: true, full: true, maxH: 1400 },
  { file: "03-workspace-drafts.png", path: "/admin/write", signed: true },
  { file: "04-workspace-article.png", path: "/admin/write/draft-1", signed: true },
  { file: "05-workspace-research.png", path: "/admin/write/draft-2", signed: true },
  { file: "06-workspace-read-it.png", path: "/admin/write/draft-3", signed: true },
  {
    file: "07-read-board-full.png",
    path: "/admin/write/draft-3/preview",
    signed: true,
    full: true,
    maxH: 3200,
  },
  { file: "08-document-top-shown-read.png", path: `/p/${WHEY}`, full: true, maxH: 1500 },
  { file: "09-document-after-body.png", path: `/p/${WHEY}`, at: "#ev-findings", h: 1500 },
  {
    file: "10-document-inline-link.png",
    path: "/p/documented-corruption-conflicts-interest-self-dealing-transnational",
    at: "a.xl",
    h: 900,
  },
  {
    file: "11-document-shares-sources.png",
    path: "/p/ancaster-publisher-profile-build-it-from-public-signals-verify-it-with",
    full: true,
    maxH: 1400,
  },
  {
    file: "12-concept-where-it-appears.png",
    path: "/concepts/sensory-syncrasis",
    full: true,
    maxH: 1100,
  },
  { file: "13-library-key-figures.png", path: "/library?kind=Figure", full: true, maxH: 1000 },
  {
    file: "14-document-signed-in-rail.png",
    path: `/p/${WHEY}`,
    signed: true,
    at: ".dread",
    h: 900,
  },
  {
    file: "15-phone-admin.png",
    path: "/admin",
    w: 390,
    h: 844,
    signed: true,
    full: true,
    maxH: 1600,
  },
  {
    file: "16-phone-workspace-chat.png",
    path: "/admin/write/draft-1",
    w: 390,
    h: 844,
    signed: true,
  },
  {
    file: "17-phone-workspace-page.png",
    path: "/admin/write/draft-1",
    w: 390,
    h: 844,
    signed: true,
    act: async (p) => {
      await p.click('[data-ws-tab="page"]');
      await p.waitForTimeout(1200);
    },
  },
  { file: "18-phone-document.png", path: `/p/${WHEY}`, w: 390, h: 844, full: true, maxH: 1700 },
  {
    file: "19-phone-read-it.png",
    path: "/admin/write/draft-3",
    w: 390,
    h: 844,
    signed: true,
    act: async (p) => {
      await p.click('[data-ws-tab="page"]');
      await p.waitForTimeout(1500);
    },
  },
];
for (const s of shots.filter(
  (x) => !process.argv[3] || process.argv[3].split(",").includes(x.file.slice(0, 2)),
)) {
  const page = await ctx(s.w ?? 1440, s.h ?? 900, !!s.signed);
  await page.goto(base + s.path, { waitUntil: "load" });
  await page.waitForTimeout(800);
  if (s.act) await s.act(page);
  if (s.at) {
    await page
      .locator(s.at)
      .first()
      .evaluate((el) => {
        document.documentElement.style.scrollBehavior = "auto";
        window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 160);
      });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/${s.file}` });
  } else if (s.full) {
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.screenshot({
      path: `${OUT}/${s.file}`,
      clip: { x: 0, y: 0, width: s.w ?? 1440, height: Math.min(h, s.maxH ?? h) },
      fullPage: true,
    });
  } else await page.screenshot({ path: `${OUT}/${s.file}` });
  console.log(s.file);
  await page.context().close();
}
await browser.close();
server.close();
