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

const ESSAYS = [
  [
    "the-logic-costume",
    "The Logic Costume",
    "Authority performed as logic is still a performance — and a performance leaves a record.",
  ],
  ["the-quiet-part", "The Quiet Part", "What a budget says out loud, and what it only does."],
  [
    "measurement-as-argument",
    "Measurement as Argument",
    "Choosing what to count is the whole of the claim.",
  ],
  [
    "the-costume-comes-off",
    "When the Costume Comes Off",
    "No single slip is decisive. The pattern is.",
  ],
  ["rules-for-thee", "Rules for Thee", "A standard applied in one direction is not a standard."],
];

const RESEARCH = [
  [
    "budget-2026-estimates",
    "Budget 2026: Main Estimates",
    "Tabled departmental spending, with the year-over-year deltas.",
  ],
  ["housing-starts-q3", "Housing Starts, Q3", "CMHC monthly series, seasonally adjusted."],
  [
    "lobbying-registry-extract",
    "Lobbying Registry Extract",
    "Twelve months of filings, by registrant.",
  ],
  ["transfer-payments-2025", "Transfer Payments 2025", "Every transfer over one million dollars."],
  [
    "wealth-estimates-review",
    "Wealth Estimates: A Review",
    "Three methods, three answers, one population.",
  ],
  [
    "procurement-exemptions",
    "Procurement Exemptions",
    "Sole-source contracts above the threshold.",
  ],
];

const BODY = `A person who claims to run on logic has made a testable claim, and it is tested every time they speak — not once, when the credential was asserted.

## What is the logic costume?

The logic costume is authority borrowed from a method by someone who does not submit to that method's checks. It is worn, not earned.

Actual logic is a discipline with failure conditions. A valid argument can be shown invalid; every fallacy has a name and a form. The costume keeps the vocabulary and discards the exposure.

## Why does performing logic work on an audience?

Performed logic works because audiences reward the signals of rigour faster than they can check the rigour itself.

Checking takes time; the signal is instant. A live audience cannot pause to verify a syllogism, so the performance is judged on affect.

## Sources

1. Copi, I. Introduction to Logic. Pearson, 2016.
2. Postman, N. Amusing Ourselves to Death. Viking, 1985.
`;

const row = (slug: string, title: string, subtitle: string, kind: string, i: number) => ({
  id: slug,
  slug,
  title,
  subtitle,
  kind,
  subtype: null,
  publication_status: "published",
  byline: null,
  published_at: `2026-0${(i % 9) + 1}-1${i % 9}T00:00:00.000Z`,
  signed_by: null,
  body_md: BODY,
  body_html: null,
  chain_id: null,
  tags: "[]",
  metadata: "{}",
  argument_summary_md: null,
  created_at: `2026-0${(i % 9) + 1}-1${i % 9}T00:00:00.000Z`,
  updated_at: "2026-09-10T00:00:00.000Z",
  body_chars: BODY.length,
});

const ALL = [
  ...ESSAYS.map(([s, t, d], i) => row(s as string, t as string, d as string, "essay", i)),
  ...RESEARCH.map(([s, t, d], i) =>
    row(s as string, t as string, d as string, "research-report", i + 3),
  ),
];

function makeDb(): D1Database {
  const mk = (sql: string) => {
    let bound: unknown[] = [];
    const stmt = {
      bind(...a: unknown[]) {
        bound = a;
        return stmt;
      },
      async first() {
        if (/FROM users/i.test(sql)) return { id: "u1" };
        if (/FROM pieces WHERE user_id = \? AND slug = \?/i.test(sql)) {
          return ALL.find((p) => p.slug === bound[1]) ?? null;
        }
        if (/MAX\(/i.test(sql)) return { d: "2026-09-10T00:00:00.000Z" };
        // The counts query asks three different questions with the same
        // COUNT(*) shape, so answer by what each one filters on — otherwise
        // the state strip shows the same number in every cell and looks
        // plausible while being meaningless.
        if (/COUNT\(\*\)/i.test(sql)) {
          if (/kind = 'essay'/i.test(sql)) return { n: ESSAYS.length };
          if (/kind <> 'essay'/i.test(sql)) return { n: RESEARCH.length };
          if (/FROM sources/i.test(sql)) return { n: ALL.length };
          return { n: ALL.length };
        }
        return null;
      },
      async all() {
        if (/FROM pieces/i.test(sql) && /publication_status IN/i.test(sql)) {
          const kinds = bound.slice(1).filter((b): b is string => typeof b === "string");
          if (!kinds.length) return { results: ALL };
          // NOT IN must actually exclude. Matching the bound values as an
          // allow-list regardless of the operator made /research render the
          // essays back — a fixture that quietly contradicts the query it is
          // standing in for is worse than no fixture.
          const negated = /kind NOT IN/i.test(sql);
          return {
            results: ALL.filter((p) =>
              negated ? !kinds.includes(p.kind) : kinds.includes(p.kind),
            ),
          };
        }
        return { results: [] };
      },
      async run() {
        return { results: [], meta: { changes: 0 } };
      },
    };
    return stmt as unknown as D1PreparedStatement;
  };
  return {
    prepare: (sql: string) => mk(sql),
    dump: async () => new ArrayBuffer(0),
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
  } as unknown as D1Database;
}

const env = {
  SUPABASE_URL: "http://localhost:54321",
  SUPABASE_SERVICE_ROLE_KEY: "test",
  ANTHROPIC_API_KEY: "test",
  OPENPARLIAMENT_USER_AGENT: "test",
  LOG_LEVEL: "error",
  DB: makeDb(),
};

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
  // /answers renders from an empty fixture on purpose: the empty state is
  // what the page looks like until the pass has run on a real document.
  ["answers", "/answers", 1400],
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
