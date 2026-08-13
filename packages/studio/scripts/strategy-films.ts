// STRATEGY FILMS — one paragraph, every compositional strategy, as films.
//
// The visual proof for docs/studio/CANOPTICON_GENERATIVE_ARCHITECTURE.md.
// Same words, same seed, same director dials; only the strategy differs.
// Each MOVE becomes its own shot with its own window, which is why the
// output is cut rather than held.
//
//   npx tsx packages/studio/scripts/strategy-films.ts <outDir>
//   node  packages/studio/scripts/render-offline.mjs <outDir>/TYPOGRAPHIC.json film.webm
//
import fs from "node:fs";
import {
  STRATEGIES,
  STRATEGY_IDS,
  moveCtx,
  moveDuration,
  synthesise,
} from "../experiments/strategy.ts";
import { extractFigures } from "../src/compile/figures.ts";
import { readRelation } from "../src/compile/relation.ts";
import { detectSubjects } from "../src/compile/subject.ts";

const PARAGRAPH = [
  "The city had learned to watch without looking.",
  "A camera became a record.",
  "It emerged from thousands of ordinary decisions.",
];
const COUNTS = [null, null, 96];
const outDir = process.argv[2];
fs.mkdirSync(outDir, { recursive: true });

function build(id: string, pick?: (mi: number, p: number) => (typeof STRATEGIES)[string]) {
  const scenes: Record<string, unknown>[] = [];
  let t = 0;
  for (const [i, sentence] of PARAGRAPH.entries()) {
    const subs = detectSubjects(sentence);
    const rel = readRelation(sentence) ?? null;
    const figs = extractFigures(sentence);
    const count =
      COUNTS[i] ??
      (figs.length ? Number(String(figs[0]?.value).replace(/[^0-9.]/g, "")) || null : null);
    const progress = PARAGRAPH.length > 1 ? i / (PARAGRAPH.length - 1) : 0;
    const ctx = moveCtx(sentence, subs, rel, count, progress, 101 + i * 7);
    const base = STRATEGIES[id];
    if (!base) throw new Error(`no such strategy: ${id}`);
    const moves = base.arc(ctx);
    for (const [mi, mv] of moves.entries()) {
      const st = pick ? pick(mi, progress) : base;
      const nodes = st.realise(mv, ctx);
      const dur = moveDuration(mv, progress, 101 + i * 7 + mi);
      scenes.push({
        sceneId: `${st.id}-${i}-${mv}`,
        text: sentence,
        startMs: t,
        endMs: t + dur,
        shots: [],
        chain: nodes.map((nd, k) => ({
          id: nd.primitiveId,
          params: nd.params,
          seed: 900 + i * 37 + mi * 11 + k,
        })),
      });
      t += dur;
    }
  }
  return { scenes, ms: t };
}

const made: string[] = [];
for (const id of STRATEGY_IDS) {
  const f = build(id);
  fs.writeFileSync(`${outDir}/${id}.json`, JSON.stringify(f));
  made.push(`${id.padEnd(15)} ${f.scenes.length} shots · ${(f.ms / 1000).toFixed(1)}s`);
}
const syn = build("TYPOGRAPHIC", (mi, p) =>
  synthesise(["MATERIAL", "TYPOGRAPHIC", "DIAGRAMMATIC"], mi, p),
);
fs.writeFileSync(`${outDir}/SYNTHESIS.json`, JSON.stringify(syn));
made.push(`${"SYNTHESIS".padEnd(15)} ${syn.scenes.length} shots · ${(syn.ms / 1000).toFixed(1)}s`);
console.log(made.join("\n"));
