// Build a real FilmCut from an essay, with no Worker and no network.
//
// The rules editor and the estimator are both pure, so the whole authoring
// path up to the cut runs in-process. This is the input to `look.mjs`, and
// it exists so the loop is BUILD → LOOK in seconds rather than BUILD →
// DEPLOY → LOOK in minutes.
//
// NARRATION=<dir> makes the cut a NARRATED one, off `scripts/narrate.mjs`'s
// local recording. That matters more than being able to hear it: without a
// spine the film is cut against `estimateSpine`, a 150-words-per-minute
// guess made from character counts, so the engine's central claim — the
// picture answers to the voice — was untested every single time it was
// looked at here. With it, `buildSpine` runs the real Needleman–Wunsch
// aligner over real measured durations, which is the same code path the
// deployed Worker takes.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { buildCut } from "../src/cut/index.ts";
import { readEssayStructurally } from "../src/editor/rules.ts";
import type { Film, FilmCut } from "../src/film/schema.ts";
import { planSpans } from "../src/narrate/spans.ts";
import { estimateSpine } from "../src/timeline/estimate.ts";
import { buildSpine } from "../src/timeline/spine.ts";

const [essayPath, outPath] = process.argv.slice(2);
const seed = Number(process.env.SEED ?? 4210);
const essay = fs.readFileSync(essayPath, "utf8");

const editorial = readEssayStructurally(essay);
const film: Film = {
  schema: "canopticon.film/1",
  filmId: "look",
  title: editorial.title || "Untitled",
  essay,
  seed,
  settings: {
    pace: Number(process.env.PACE ?? 0.5),
    chaos: Number(process.env.CHAOS ?? 0.5),
    density: Number(process.env.DENSITY ?? 0.5),
  },
  editorial,
  editorialHash: "look",
  editorialProvenance: {
    source: "rules",
    promptVersion: "look",
    createdAt: new Date(0).toISOString(),
  },
} as Film;

/* ── the spine, measured if there is a recording ─────────────────────── */

interface LocalSpan {
  spanId: string;
  wav: string;
  startMs: number;
  durationMs: number;
  words: { word: string; startMs: number; endMs: number }[];
}

const narrationDir = process.env.NARRATION;
let spine = estimateSpine(essay, editorial.sections);
let voice: FilmCut["voice"] = null;

if (narrationDir) {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(narrationDir, "narration.json"), "utf8"),
  ) as { method: string; spans: LocalSpan[] };
  // The spans are re-planned rather than trusted from the manifest, so a
  // recording made against a since-edited essay lines up by id or does not
  // line up at all — the same refusal `loadSpans` makes in the Worker.
  const planned = new Map(planSpans(essay, editorial).map((s) => [s.spanId, s]));
  const measured = manifest.spans
    .map((m) => {
      const span = planned.get(m.spanId);
      return span ? { span, heard: m.words, durationMs: m.durationMs } : null;
    })
    .filter((m): m is NonNullable<typeof m> => m !== null);
  if (measured.length !== manifest.spans.length) {
    console.error(
      `narration is stale: ${manifest.spans.length - measured.length} recorded spans no longer exist — re-run narrate.mjs`,
    );
    process.exit(1);
  }
  spine = buildSpine(essay, measured);
  voice = {
    spans: manifest.spans.map((m) => ({
      spanId: m.spanId,
      startMs: m.startMs,
      durationMs: m.durationMs,
      // Served by clip.mjs from the narration directory.
      url: `/__vo/${m.wav}`,
      sha256: crypto
        .createHash("sha256")
        .update(fs.readFileSync(path.join(narrationDir, m.wav)))
        .digest("hex"),
    })),
  };
}

const cut = await buildCut({ film, spine, voice });
fs.writeFileSync(outPath, JSON.stringify(cut, null, 1));

const withText = cut.beats.filter((b) => b.text.phrases.length > 0).length;
console.log(
  `${cut.beats.length} beats · ${(cut.durationMs / 1000).toFixed(1)}s · ` +
    `${withText}/${cut.beats.length} carry text (${Math.round((withText / cut.beats.length) * 100)}%) · ` +
    `spine ${spine.source}${voice ? ` · ${voice.spans.length} spans of voice` : " · silent"}`,
);
for (const w of cut.warnings) console.log(`  ${w}`);
