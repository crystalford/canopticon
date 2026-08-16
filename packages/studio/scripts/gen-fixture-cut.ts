import fs from "node:fs";
import { buildCut } from "../src/cut/index.ts";
import { readEssayStructurally } from "../src/editor/rules.ts";
import { hashRecord } from "../src/lib/hash.ts";
import { estimateSpine } from "../src/timeline/estimate.ts";

const ESSAY = `Gimmick Economy

Jeremy Hambly built a career on being angry at the right people. The channel did not sell an argument. It sold a mood.

A platform pays for attention, not accuracy, so the fastest route to revenue is manufactured conflict. The performer does not need to be right.

The medium doesn't reward having been right before. It rewards winning now.`;

async function main() {
  const editorial = readEssayStructurally(ESSAY);
  const film = {
    schema: "canopticon.film/1" as const,
    filmId: "f1",
    title: "Gimmick Economy",
    essay: ESSAY,
    seed: 1,
    settings: { pace: 0.5, chaos: 0.5, density: 0.5 },
    renderBackend: (process.argv[3] === "three" ? "threejs-procedural" : "canvas-2d-legacy") as
      | "canvas-2d-legacy"
      | "threejs-procedural",
    editorial,
    editorialHash: await hashRecord(editorial),
    editorialProvenance: {
      source: "rules" as const,
      promptVersion: "test",
      createdAt: "2020-01-01T00:00:00.000Z",
      rejectedPhrases: 0,
    },
    narration: { voice: null, spans: [] },
    assets: [],
    createdAt: "2020-01-01T00:00:00.000Z",
  };
  const spine = estimateSpine(ESSAY, film.editorial.sections);
  const cut = await buildCut({ film, spine });
  const out = process.argv[2];
  fs.writeFileSync(out, JSON.stringify({ cut, film }));
  console.log(`wrote ${out}: ${cut.beats.length} beats, ${cut.durationMs}ms, ${cut.renderBackend}`);
}
main();
