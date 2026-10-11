// BUILD THE CONTENT STORE — content/ in, src/site/content/store.gen.json out.
//
// The Black Box handoff (docs/blackbox/README.md) delivered the record as
// files: research documents, articles and papers as Markdown with front
// matter, and the derived lists (library, questions, key figures, concepts,
// open problems, the topic timeline) as JSON. Those files are the source of
// truth and stay readable in the repo. This script compiles them into one JSON
// module the Worker imports, so every surface — page, twin, feed, search —
// reads the same rows (standing rule 3).
//
// It is also the publish gate for rule 1, verbatim or nothing: every <q> in an
// article must be a literal substring of the document it names, ignoring only
// Markdown emphasis and whitespace. One failure stops the build, which stops
// the deploy. Nothing is vouched for.
//
// Run by `wrangler [build]` before every deploy and dry run, and by the
// package's typecheck and test scripts. Plain Node, no dependencies, so it runs
// anywhere the repo does.
//
//   node scripts/build-content.mjs

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT = join(ROOT, "content");
const OUT = join(ROOT, "src", "site", "content", "store.gen.json");

const ENTITIES = { "&quot;": '"', "&amp;": "&", "&#39;": "'", "&lt;": "<", "&gt;": ">" };
const unentity = (s) => s.replace(/&(quot|amp|#39|lt|gt);/g, (m) => ENTITIES[m] ?? m);

/** The front-matter subset the handoff uses: JSON-quoted scalars, bare
 *  booleans and numbers, and one list of {id,label} maps (based_on). */
export function parseFrontMatter(text) {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  if (!m) return { meta: {}, body: text };
  const meta = {};
  let list = null;
  let item = null;
  for (const line of m[1].split("\n")) {
    const top = /^([A-Za-z_][\w-]*):\s?(.*)$/.exec(line);
    if (top) {
      const [, key, raw] = top;
      if (raw.trim() === "") {
        list = meta[key] = [];
        item = null;
      } else {
        meta[key] = scalar(raw.trim());
        list = null;
      }
      continue;
    }
    const start = /^\s+-\s+([\w-]+):\s?(.*)$/.exec(line);
    if (start && list) {
      item = { [start[1]]: scalar(start[2].trim()) };
      list.push(item);
      continue;
    }
    const cont = /^\s+([\w-]+):\s?(.*)$/.exec(line);
    if (cont && item) item[cont[1]] = scalar(cont[2].trim());
  }
  return { meta, body: text.slice(m[0].length) };
}

function scalar(raw) {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  if (raw.startsWith('"')) {
    try {
      return unentity(JSON.parse(raw));
    } catch {
      return unentity(raw.slice(1, -1));
    }
  }
  return unentity(raw);
}

/** What "a literal substring" is measured against: emphasis markers and
 *  backslash escapes removed, whitespace collapsed. Nothing else is forgiven —
 *  not case, not quote style, not punctuation. */
export function verbatimNormal(s) {
  return s
    .replace(/[*_`]/g, "")
    .replace(/\\([^\w\s])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

const readJson = (f) => JSON.parse(readFileSync(join(CONTENT, f), "utf8"));
const mdFiles = (dir) =>
  readdirSync(join(CONTENT, dir))
    .filter((f) => f.endsWith(".md"))
    .sort();

function build() {
  const research = {};
  for (const [dir, visibility] of [
    ["research", "public"],
    ["research-held", "held"],
  ]) {
    for (const f of mdFiles(dir)) {
      const { meta, body } = parseFrontMatter(readFileSync(join(CONTENT, dir, f), "utf8"));
      const id = String(meta.id ?? f.slice(0, -3));
      research[id] = {
        id,
        title: String(meta.title ?? id),
        kind: String(meta.kind ?? "Research"),
        topic: String(meta.topic ?? "Other"),
        date: String(meta.date ?? ""),
        shelf: String(meta.shelf ?? ""),
        listed: meta.listed_in_library === true,
        visibility,
        body,
      };
    }
  }

  const articles = {};
  for (const f of mdFiles("articles")) {
    const { meta, body } = parseFrontMatter(readFileSync(join(CONTENT, "articles", f), "utf8"));
    const slug = String(meta.slug ?? f.slice(0, -3));
    articles[slug] = { ...meta, slug, kind: "Article", body };
  }

  const papers = {};
  for (const f of mdFiles("papers")) {
    const { meta, body } = parseFrontMatter(readFileSync(join(CONTENT, "papers", f), "utf8"));
    const slug = String(meta.slug ?? f.slice(0, -3));
    papers[slug] = { ...meta, slug, kind: "Paper", body };
  }

  // Verbatim or nothing.
  const normal = new Map();
  const failures = [];
  let checked = 0;
  for (const a of Object.values(articles)) {
    for (const m of a.body.matchAll(/<q\s+([^>]*)>([\s\S]*?)<\/q>/g)) {
      checked++;
      const doc = /doc="([^"]*)"/.exec(m[1])?.[1];
      const src = doc ? research[doc] : undefined;
      if (!src) {
        failures.push(`${a.slug}: <q> names no stored document (${doc ?? "none"})`);
        continue;
      }
      if (!normal.has(doc)) normal.set(doc, verbatimNormal(src.body));
      if (!normal.get(doc).includes(verbatimNormal(m[2]))) {
        failures.push(`${a.slug}: not verbatim in ${doc}: "${m[2].slice(0, 90)}"`);
      }
    }
    for (const m of a.body.matchAll(/\]\(doc:([^)\s]+)\)/g)) {
      if (!research[m[1]]) failures.push(`${a.slug}: links to a missing document ${m[1]}`);
    }
    for (const b of a.based_on ?? []) {
      if (!research[b.id]) failures.push(`${a.slug}: based on a missing document ${b.id}`);
    }
  }
  if (failures.length) {
    console.error(`content: ${failures.length} of ${checked} checks failed — nothing publishes:`);
    for (const f of failures) console.error(`  ${f}`);
    process.exit(1);
  }

  // Hand-built pages ported as-is (docs/blackbox/README.md: "Three concepts
  // and one open problem have hand-built long pages; port them as-is"), plus
  // About. Each file opens with a <!--meta {json} --> line naming its route.
  const pages = {};
  for (const f of readdirSync(join(CONTENT, "pages")).filter((x) => x.endsWith(".html")).sort()) {
    const text = readFileSync(join(CONTENT, "pages", f), "utf8");
    const m = /^<!--meta (.*?) -->\n/.exec(text);
    if (!m) {
      console.error(`content: pages/${f} has no meta line`);
      process.exit(1);
    }
    const meta = JSON.parse(m[1]);
    pages[meta.route] = { ...meta, body: text.slice(m[0].length) };
  }

  const store = {
    library: readJson("library.json"),
    questions: readJson("questions.json"),
    figures: readJson("key-figures.json"),
    terms: readJson("terms.json"),
    problems: readJson("problems.json"),
    timeline: readJson("topic-timeline.json"),
    research,
    articles,
    papers,
    pages,
    verified: { quotes: checked },
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(store));
  const held = Object.values(research).filter((r) => r.visibility === "held").length;
  console.log(
    `content: ${Object.keys(research).length} documents (${held} held), ${Object.keys(articles).length} articles, ${Object.keys(papers).length} papers, ${checked} quotes verified`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) build();
