// Turn a piece's figure plan into the player's spec (2026-11-28).
//
// The piece is the only source: its title and short version open the video,
// each move of its skeleton is one shot drawing that move's figure over the
// line written for it (or the move itself), and its formula closes it before
// the video loops. Nothing is written here that the piece does not say.
//
//   node plan.mjs <slug> [out.json]
//
// Reads packages/api/src/site/content/store.gen.json, so run the content build
// (`node packages/api/scripts/build-content.mjs`) first.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const STORE = join(here, "../api/src/site/content/store.gen.json");

// A move's role sets its colour: what the evidence shows, what limits it, and
// what to do with it.
const COLOUR = {
  evidence: "gist",
  claim: "gist",
  reframe: "gist",
  mechanism: "gist",
  condition: "cue",
  limit: "cue",
  objection: "cue",
  name: "cue",
  opening: "rebuild",
  method: "rebuild",
  so: "rebuild",
};

export function specFor(piece) {
  const moves = (piece.build ?? []).map((m) => {
    const [role = "", text = ""] = String(m.move).split("|");
    return { role: role.trim(), text: text.trim() };
  });
  const plan = new Map((piece.figure_plan ?? []).map((f) => [f.move, f]));
  if (!plan.size) throw new Error(`${piece.slug} has no figure plan`);
  const rows = (d) =>
    String(d)
      .split("||")
      .map((r) => r.trim())
      .filter(Boolean);
  const beats = [
    {
      type: "title",
      dur: 4,
      color: "gist",
      word: piece.title
        .split(" ")
        .sort((a, b) => b.length - a.length)[0]
        .toUpperCase(),
      words: piece.glance_words,
      say: `${piece.title}. ${piece.glance_words}`,
    },
  ];
  moves.forEach((m, i) => {
    const f = plan.get(i + 1);
    if (!f) return;
    const beat = {
      type: f.kind,
      dur: 4,
      move: i + 1,
      role: m.role,
      color: COLOUR[m.role.toLowerCase()] ?? "gist",
      word: m.role.toUpperCase(),
      label: f.title ?? m.role,
      say: f.say ?? m.text,
    };
    if (f.kind === "chain") beat.items = f.data.split("|").map((w) => w.trim());
    if (f.kind === "steps") beat.items = rows(f.data);
    if (f.kind === "compare") {
      beat.rows = rows(f.data).map((r) => r.split("|").map((x) => x.trim()));
      beat.hot = f.hot ?? 0;
    }
    if (f.kind === "loop") beat.items = (piece.cycle ?? []).map((c) => c.split("|")[0].trim());
    if (f.kind === "quote") beat.text = f.data;
    if (f.kind === "steps" || f.kind === "loop") beat.hold = 1.6;
    beats.push(beat);
  });
  beats.push({
    type: "close",
    dur: 4,
    color: "rebuild",
    word: "IDEA",
    lines: String(piece.glance_formula)
      .split("||")
      .map((l) => l.trim()),
    say: piece.glance_sentence,
    hold: 2.6,
  });
  return { kind: piece.form ?? piece.kind, title: piece.title, slug: piece.slug, beats };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [slug, out] = process.argv.slice(2);
  const store = JSON.parse(readFileSync(STORE, "utf8"));
  const piece = store.articles?.[slug] ?? store.papers?.[slug];
  if (!piece) throw new Error(`no essay or paper called ${slug}`);
  const spec = JSON.stringify(specFor(piece), null, 1);
  if (out) writeFileSync(out, `${spec}\n`);
  else process.stdout.write(`${spec}\n`);
}
