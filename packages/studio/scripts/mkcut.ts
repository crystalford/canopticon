// Build a real FilmCut from an essay, with no Worker and no network.
//
// The rules editor and the estimator are both pure, so the whole authoring
// path up to the cut runs in-process. This is the input to `look.mjs`, and
// it exists so the loop is BUILD → LOOK in seconds rather than BUILD →
// DEPLOY → LOOK in minutes. It is silent and estimated-timing; the narrated
// film is still judged after deploy.

import fs from "node:fs";
import { buildCut } from "../src/cut/index.ts";
import { readEssayStructurally } from "../src/editor/rules.ts";
import type { Film } from "../src/film/schema.ts";
import { estimateSpine } from "../src/timeline/estimate.ts";

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

const spine = estimateSpine(essay, editorial.sections);
const cut = await buildCut({ film, spine });
fs.writeFileSync(outPath, JSON.stringify(cut, null, 1));

const withText = cut.beats.filter((b) => b.text.phrases.length > 0).length;
console.log(
  `${cut.beats.length} beats · ${(cut.durationMs / 1000).toFixed(1)}s · ` +
    `${withText}/${cut.beats.length} carry text (${Math.round((withText / cut.beats.length) * 100)}%)`,
);
