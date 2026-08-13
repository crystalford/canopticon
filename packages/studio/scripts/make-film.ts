// MAKE-FILM — the whole pipeline, offline, from prose to a film plan.
//
// The deployed Studio does this over HTTP with a database behind it. This
// runs the same compiler functions in-process so a film can be made and
// looked at without a Worker, a D1 or a network — which is the difference
// between "the architecture could express this" and a file you can watch.
//
// It writes:
//   film.json   the FilmPlan the Lab's renderer consumes
//   ir.json     the IR it was compiled from
//   report.txt  what the compiler decided, per beat, in its own words

import fs from "node:fs";
import path from "node:path";
import { buildFilmPlan } from "../src/compile/film.ts";
import { compile } from "../src/compile/index.ts";
import { segmentEssay } from "../src/compile/segment.ts";
import { type EditorialIR, parseIR } from "../src/ir/schema.ts";

const [essayPath, outDir] = process.argv.slice(2);
if (!essayPath || !outDir) {
  console.error("usage: make-film.ts <essay.md> <outDir> [--state state.json]");
  process.exit(1);
}
const stateIdx = process.argv.indexOf("--state");
const statePath = stateIdx > -1 ? process.argv[stateIdx + 1] : null;

const essay = fs.readFileSync(essayPath, "utf8");
fs.mkdirSync(outDir, { recursive: true });

const seed = segmentEssay(essay, { projectId: "surveillance" });
const raw = JSON.parse(JSON.stringify(seed.ir)) as EditorialIR;

// THE FILM'S OWN ARC. Control points are the director's instrument, and a
// film whose curve never moves is 40 unrelated scenes with one look. This
// is where an act structure becomes a visual trajectory rather than a
// heading in the prose.
if (statePath) {
  const authored = JSON.parse(fs.readFileSync(statePath, "utf8"));
  raw.creativeState = authored.creativeState;
  if (authored.visualLanguage) raw.visualLanguage = authored.visualLanguage;
  if (authored.sceneDirection) {
    for (const [i, direction] of Object.entries(
      authored.sceneDirection as Record<string, { feel?: string; notice?: string }>,
    )) {
      const scene = raw.scenes[Number(i)];
      if (scene) scene.directorIntent = direction;
    }
  }
  if (authored.sceneLanguage) {
    for (const [i, lang] of Object.entries(authored.sceneLanguage as Record<string, string>)) {
      const scene = raw.scenes[Number(i)];
      // biome-ignore lint/suspicious/noExplicitAny: validated by parseIR below
      if (scene) scene.visualLanguage = lang as any;
    }
  }
}

const parsed = parseIR(raw);
if (!parsed.ok) {
  console.error("IR did not validate:");
  for (const e of parsed.errors) console.error(`  ${e.path}: ${e.message}`);
  process.exit(1);
}
const ir = parsed.ir;

// THE REAL COMPILER, not a re-assembly of its parts. `compile()` is what
// the Worker's own /compile route calls; using anything else here would
// be a second pipeline that could disagree with production about what a
// film is.
const report = await compile(ir);
const { composed, timing, usage } = report;
const plan = buildFilmPlan(ir, report);

fs.writeFileSync(path.join(outDir, "ir.json"), JSON.stringify(ir, null, 2));
fs.writeFileSync(path.join(outDir, "film.json"), JSON.stringify(plan, null, 2));

const lines: string[] = [];
const runtime = Math.max(...plan.scenes.map((s) => s.endMs)) / 1000;
lines.push(
  `RUNTIME  ${Math.floor(runtime / 60)}m${String(Math.round(runtime % 60)).padStart(2, "0")}s`,
);
lines.push(`SCENES   ${plan.scenes.length}`);
lines.push(`ACTS     ${ir.acts.length}`);
lines.push(
  `COST     ${(composed.reduce((n, c) => n + c.costMsPerFrame, 0) / composed.length).toFixed(1)}ms/frame mean, ${Math.max(...composed.map((c) => c.costMsPerFrame))}ms peak`,
);
lines.push(
  `PALETTE  ${usage.primitives.length} distinct primitives · ${usage.unusedInPalette} of the palette untouched`,
);
lines.push(
  `LINKS    ${(usage.linkHonesty * 100).toFixed(0)}% of chain links honest · ${usage.groundedScenes} scenes composited`,
);
lines.push(`GROUNDS  ${usage.grounds.length} distinct compositor pairings\n`);

for (const [i, c] of composed.entries()) {
  const scene = ir.scenes.find((s) => s.sceneId === c.sceneId);
  const w = timing.scenes.find((s) => s.sceneId === c.sceneId);
  lines.push(
    `─── ${String(i).padStart(2, "0")} · ${c.actId} · ${c.tier} · abstraction ${c.abstraction.toFixed(2)}`,
  );
  lines.push(`    "${scene?.narration.text ?? ""}"`);
  lines.push(
    `    ${((w?.startMs ?? 0) / 1000).toFixed(1)}s–${((w?.endMs ?? 0) / 1000).toFixed(1)}s · ${c.costMsPerFrame}ms/frame`,
  );
  const flat: string[] = [];
  const walk = (ns: typeof c.nodes, d: number) => {
    for (const n of ns) {
      flat.push(`${"  ".repeat(d)}${n.primitiveId}`);
      walk(n.ground ?? [], d + 1);
    }
  };
  walk(c.nodes, 0);
  lines.push(`    CHAIN ${flat.join(" · ").replace(/\s+/g, " ")}`);
  for (const n of c.notes) lines.push(`    · ${n}`);
  lines.push("");
}
fs.writeFileSync(path.join(outDir, "report.txt"), lines.join("\n"));

console.log(lines.slice(0, 6).join("\n"));
console.log(`\nwrote ${outDir}/film.json, ir.json, report.txt`);
