// LANGUAGE LAB — one paragraph, every visual language, side by side, live.
//
// The point of this is not another render. It is that the operator can
// open a file and CLICK, instead of waiting for someone else to produce
// an output and describe it. A comparison you can drive is worth more
// than a comparison you are shown.
//
// It emits ONE self-contained HTML file. No server, no build step, no
// network: the Lab's own primitives and chain executor are inlined, and
// every language's compiled plan is baked in as JSON. Open it, press a
// key, watch the same paragraph become a different kind of film.
//
// The plans come from the real compiler — `language.ts` reading the real
// prose through the real word ranker — so what plays here is what the
// pipeline would render.

import fs from "node:fs";
import path from "node:path";
import type { PlannedNode } from "../src/compile/construct.ts";
import { extractFigures } from "../src/compile/figures.ts";
import {
  LANGUAGE_IDS,
  type LanguageId,
  assemble,
  chainFor,
  contextFor,
  describeLanguage,
  planSynthesis,
} from "../src/compile/language.ts";
import { readRelation } from "../src/compile/relation.ts";
import { segmentEssay } from "../src/compile/segment.ts";
import { detectSubjects } from "../src/compile/subject.ts";
import { PRIMITIVES } from "../src/primitives/registry.ts";

const [essayPath, outPath] = process.argv.slice(2);
if (!essayPath || !outPath) {
  console.error("usage: language-lab.ts <essay.md> <out.html> [--beat-ms 2600]");
  process.exit(1);
}
const beatIdx = process.argv.indexOf("--beat-ms");
const BEAT_MS = beatIdx > -1 ? Number(process.argv[beatIdx + 1]) : 2600;
const MAX_BEATS = 14;

const essay = fs.readFileSync(essayPath, "utf8");
const seed = segmentEssay(essay, { projectId: "lab" });
const scenes = seed.ir.scenes.slice(0, MAX_BEATS);

// One style for every language, so the only variable is the language.
const style = {
  abstraction: 0.45,
  density: 0.55,
  energy: 0.5,
  human: 0.45,
  typography: 0.55,
  archival: 0.5,
  data: 0.5,
  experimentalism: 0.5,
  restraint: 0.35,
  population: 0.5,
  attention: 0.5,
  tier: "ANNOTATED" as const,
  language: "documentary" as const,
};

const outs = (id: string) => PRIMITIVES[id]?.outputs ?? [];
const toFilm = (nodes: PlannedNode[], base: number): unknown[] =>
  nodes.map((node, i) => ({
    id: node.primitiveId,
    params: node.params,
    seed: base + i * 7,
    ...(node.ground ? { b: toFilm(node.ground, base + 311) } : {}),
  }));

function beatFor(i: number) {
  const text = scenes[i]?.narration.text ?? "";
  return {
    sentence: text,
    phrase: text.toUpperCase().replace(/[.,]/g, "").slice(0, 30),
    subjects: detectSubjects(text),
    figures: extractFigures(text),
    route: [] as string[],
    kind: "statement" as const,
    contested: false,
    index: i,
    relation: readRelation(text) ?? undefined,
  };
}

/** Compile the whole passage in one language. */
function filmIn(id: LanguageId, pick?: (i: number) => LanguageId) {
  const out: unknown[] = [];
  let t = 0;
  const used = new Set<string>();
  for (let i = 0; i < scenes.length; i++) {
    const lang = pick ? pick(i) : id;
    const beat = beatFor(i);
    const ctx = contextFor(beat, style, 100 + i * 13);
    const built = chainFor(lang, ctx);
    if (!built) continue;
    const nodes = assemble(built, outs);
    for (const n of nodes) used.add(n.primitiveId);
    out.push({
      sceneId: `${lang}-${i}`,
      text: beat.sentence,
      startMs: t,
      endMs: t + BEAT_MS,
      shots: [],
      chain: toFilm(nodes, 500 + i * 41),
      lang,
      why: built.why,
    });
    t += BEAT_MS;
  }
  return { scenes: out, used: [...used] };
}

const spoken = LANGUAGE_IDS.filter((l) => l !== "ILLUSTRATIVE");
const films: Record<string, unknown> = {};
const meta: Record<string, unknown> = {};
for (const id of spoken) {
  films[id] = filmIn(id);
  meta[id] = describeLanguage(id);
}
// SYNTHESIS: the crossing, as its own entry.
const syn = planSynthesis("MATERIAL", "TYPOGRAPHIC", scenes.length);
films.SYNTHESIS = filmIn("TYPOGRAPHIC", (i) => syn.at[i] ?? "TYPOGRAPHIC");
meta.SYNTHESIS = {
  name: "Synthesis",
  feels: "transforming · unstable · argued",
  argument: syn.why,
};

const LAB = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "lab");
const SCRIPTS = [
  "primitives.js",
  "prims-a.js",
  "prims-b.js",
  "prims-c.js",
  "prims-d.js",
  "prims-e.js",
  "prims-f.js",
  "prims-g.js",
  "prims-h.js",
  "prims-i.js",
  "prims-j.js",
  "chain.js",
];
const inlined = SCRIPTS.map((f) => fs.readFileSync(path.join(LAB, f), "utf8")).join("\n;\n");
const order = [...spoken, "SYNTHESIS"];

const html = `<!doctype html>
<meta charset="utf-8"><title>Canopticon — Language Lab</title>
<style>
  :root { --bg:#0a0b0c; --ink:#eef1f3; --mute:#8b949b; --line:#1d2124; --hi:#7fe3c0; }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 "Space Grotesk",system-ui,sans-serif}
  header{padding:18px 22px 12px;border-bottom:1px solid var(--line)}
  h1{margin:0;font-size:15px;letter-spacing:.14em;text-transform:uppercase;font-weight:600}
  .sub{color:var(--mute);font-size:12px;margin-top:5px}
  nav{display:flex;gap:0;flex-wrap:wrap;border-bottom:1px solid var(--line)}
  nav button{flex:1;min-width:120px;background:none;border:0;border-right:1px solid var(--line);
    color:var(--mute);padding:13px 10px;font:600 11px/1.2 "JetBrains Mono",monospace;
    letter-spacing:.1em;cursor:pointer;text-transform:uppercase}
  nav button:hover{color:var(--ink);background:#101315}
  nav button[aria-selected=true]{color:var(--bg);background:var(--hi)}
  main{display:grid;grid-template-columns:1fr 330px;gap:0;height:calc(100vh - 132px)}
  #stage{display:flex;align-items:center;justify-content:center;background:#000;overflow:hidden}
  canvas{max-width:100%;max-height:100%;display:block}
  aside{border-left:1px solid var(--line);padding:20px;overflow:auto}
  .k{font:600 10px/1 "JetBrains Mono",monospace;letter-spacing:.16em;color:var(--mute);text-transform:uppercase}
  .name{font-size:19px;font-weight:600;margin:8px 0 4px}
  .feels{color:var(--hi);font-size:12px;font-family:"JetBrains Mono",monospace}
  .arg{margin:12px 0 20px;color:#c3cace;font-size:13px}
  .line{border-top:1px solid var(--line);margin:16px 0}
  .say{font-size:13px;color:var(--ink);margin-bottom:6px}
  .why{color:var(--mute);font-size:11px;font-family:"JetBrains Mono",monospace;margin-bottom:14px}
  .chain{font:11px/1.7 "JetBrains Mono",monospace;color:var(--mute);word-break:break-all}
  .chain b{color:var(--ink);font-weight:400}
  footer{border-top:1px solid var(--line);padding:9px 22px;color:var(--mute);
    font:11px/1 "JetBrains Mono",monospace;display:flex;gap:22px;flex-wrap:wrap}
  kbd{background:#161a1c;border:1px solid var(--line);border-radius:3px;padding:1px 5px;color:var(--ink)}
</style>
<header>
  <h1>Canopticon · Language Lab</h1>
  <div class="sub">One paragraph. Every visual language. The same semantic reading behind all of them.</div>
</header>
<nav id="tabs"></nav>
<main>
  <div id="stage"><canvas id="c" width="1024" height="576"></canvas></div>
  <aside>
    <div class="k">Visual language</div>
    <div class="name" id="lname"></div>
    <div class="feels" id="lfeels"></div>
    <div class="arg" id="larg"></div>
    <div class="line"></div>
    <div class="k">Now saying</div>
    <div class="say" id="say"></div>
    <div class="why" id="why"></div>
    <div class="k">Chain</div>
    <div class="chain" id="chain"></div>
  </aside>
</main>
<footer>
  <span><kbd>1</kbd>–<kbd>7</kbd> language</span>
  <span><kbd>space</kbd> play / pause</span>
  <span><kbd>←</kbd> <kbd>→</kbd> beat</span>
  <span id="clock"></span>
</footer>
<script>${inlined}</script>
<script>
const FILMS = ${JSON.stringify(films)};
const META  = ${JSON.stringify(meta)};
const ORDER = ${JSON.stringify(order)};
const W = 1024, H = 576;
const cv = document.getElementById("c"), cx = cv.getContext("2d");
let current = null, built = null, playing = true, t0 = performance.now(), pausedAt = 0;

function chainOf(node, depth) {
  const pad = "&nbsp;".repeat(depth * 3);
  let s = pad + "<b>" + node.id + "</b>";
  if (node.b) s += "<br>" + node.b.map(n => chainOf(n, depth + 1)).join("<br>");
  return s;
}

function select(id) {
  current = id;
  const film = FILMS[id];
  built = film.scenes.map(sc => {
    const chain = sc.chain.map(n => ({ id: n.id, params: n.params, seed: n.seed, ...(n.b ? { b: n.b } : {}) }));
    const dur = Math.max(0.1, (sc.endMs - sc.startMs) / 1000);
    return { scene: sc, built: buildChain(chain, W, H, dur) };
  });
  const m = META[id];
  document.getElementById("lname").textContent = m.name;
  document.getElementById("lfeels").textContent = m.feels;
  document.getElementById("larg").textContent = m.argument;
  for (const b of document.querySelectorAll("nav button"))
    b.setAttribute("aria-selected", String(b.dataset.id === id));
  t0 = performance.now() - pausedAt;
}

function activeAt(ms) {
  let a = built[built.length - 1];
  for (const s of built) if (ms >= s.scene.startMs && ms < s.scene.endMs) { a = s; break; }
  return a;
}

function frame(now) {
  requestAnimationFrame(frame);
  if (!built || !built.length) return;
  const total = built[built.length - 1].scene.endMs;
  if (playing) pausedAt = (now - t0) % total;
  const ms = pausedAt;
  const a = activeAt(ms);
  const local = ms - a.scene.startMs;
  cx.fillStyle = "#000"; cx.fillRect(0, 0, W, H);
  if (a.built.errors && a.built.errors.length) {
    cx.fillStyle = "#d8624a"; cx.font = '13px "JetBrains Mono",monospace';
    a.built.errors.slice(0, 4).forEach((e, i) => cx.fillText(e, 22, 40 + i * 20));
  } else {
    cx.drawImage(a.built.run(local / 1000), 0, 0, W, H);
  }
  document.getElementById("say").textContent = a.scene.text;
  document.getElementById("why").textContent = a.scene.why + (current === "SYNTHESIS" ? "  ·  " + a.scene.lang : "");
  document.getElementById("chain").innerHTML = a.scene.chain.map(n => chainOf(n, 0)).join("<br>");
  document.getElementById("clock").textContent =
    (ms / 1000).toFixed(1) + "s / " + (total / 1000).toFixed(1) + "s";
}

const tabs = document.getElementById("tabs");
ORDER.forEach((id, i) => {
  const b = document.createElement("button");
  b.textContent = (i + 1) + " " + (META[id].name.split(" / ")[0]);
  b.dataset.id = id;
  b.onclick = () => select(id);
  tabs.appendChild(b);
});
addEventListener("keydown", e => {
  if (e.key === " ") { playing = !playing; t0 = performance.now() - pausedAt; e.preventDefault(); return; }
  const i = Number(e.key) - 1;
  if (i >= 0 && i < ORDER.length) { select(ORDER[i]); return; }
  const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
  if (step) {
    playing = false;
    const idx = built.findIndex(s => s.scene === activeAt(pausedAt).scene);
    const next = built[Math.max(0, Math.min(built.length - 1, idx + step))];
    pausedAt = next.scene.startMs + 1;
  }
});
select(ORDER[0]);
requestAnimationFrame(frame);
</script>
`;

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, html);
console.log(`${order.length} languages · ${scenes.length} beats each`);
for (const id of order) {
  const f = films[id] as { scenes: unknown[]; used: string[] };
  console.log(
    `  ${id.padEnd(15)} ${String(f.scenes.length).padStart(2)} scenes · ${f.used.length} distinct primitives`,
  );
}
console.log(
  `\nwrote ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(0)} KB, self-contained)`,
);
