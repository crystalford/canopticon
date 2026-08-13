// THE VISUAL ONE-SHOT PROOF.
//
// The unit tests say a one shot passes through intermediate states with
// identity intact. That is a claim about a data structure. This renders
// the same argument under all four modes and lays the states out in the
// order the viewer would meet them, so the claim can be judged the only
// way it can actually be settled — by looking.
//
// What to look for, and it is falsifiable:
//
//   CUT       each sentence replaces the last. Nothing carries.
//   ONE_SHOT  four states between each pair, and the thing that is in
//             both ends MOVES rather than being redrawn somewhere else.
//   MONTAGE   like CUT but with a shorter memory — things stop being
//             recalled and start arriving as strangers.
//   HYBRID    continuous, but a cut is available where one is earned.

import { writeFileSync } from "node:fs";
import { type FilmMode, bridge, bridgeCamera, step } from "./src/compile/film-mode.ts";
import { EMPTY_FILM, type FilmState } from "./src/compile/film-state.ts";
import type { Material } from "./src/compile/grammar-visual.ts";
import { readRelation } from "./src/compile/relation.ts";
import {
  type Camera,
  type SceneGraph,
  composeFromMeaning,
  emphasise,
  observe,
  serialiseScene,
} from "./src/compile/scene-graph.ts";
import { readScene } from "./src/compile/semantic-scene.ts";
import { detectSubjects } from "./src/compile/subject.ts";

/* The argument. Every noun is one the subject lexicon knows — a proof of
 * the MODE must not accidentally be a proof of the lexicon. It has the
 * shape a one shot has to solve: an accumulation, a connection, a change
 * of subject that a cutting film would simply cut on, and a return. */
const ARGUMENT = [
  "The cameras accumulated in the building.",
  "The cameras connected to a server.",
  "The server watched the residents.",
  "The contract named a warehouse.",
  "The residents watched the cameras.",
];

const MODES: FilmMode[] = ["CUT", "ONE_SHOT", "MONTAGE", "HYBRID"];

const MAT: Material = {
  noun: "",
  phrase: "THE",
  count: null,
  relation: null,
  density: 0.5,
  energy: 0.45,
  abstraction: 0.35,
  typography: 0.3,
  seed: 23,
};

function sceneFor(sentence: string) {
  const subs = detectSubjects(sentence);
  const sem = readScene(sentence, subs, readRelation(sentence), null);
  const graph = composeFromMeaning("literal", { ...MAT, noun: subs[0]?.text ?? "" }, sem);
  return { sem, graph };
}

interface Frame {
  mode: FilmMode;
  sentence: string;
  /** "" for the destination state, "2/4" for a state passed through. */
  via: string;
  decisions: string;
  describes: string;
  chain: unknown[];
}

const out: Frame[] = [];

for (const mode of MODES) {
  let state: FilmState = EMPTY_FILM;
  let previous: SceneGraph | null = null;
  let cam: Camera = { zoom: 1, x: 0.5, y: 0.5, parallax: 0.15 };

  ARGUMENT.forEach((sentence, i) => {
    const { sem, graph } = sceneFor(sentence);
    const advanced = step(mode, state, sem, graph.elements);
    state = advanced.state;

    /* THE FILM'S OWN FRAME IS WHAT GETS DRAWN — what it is carrying, in
     * the places it inherited, plus the composition around it. That
     * assembly is `advance`'s job, not the consumer's: doing it here
     * from `present(state)` alone is what produced seventeen states of
     * one faint outline on empty ground. */
    const scene: SceneGraph =
      advanced.elements.length > 0
        ? { elements: emphasise(advanced.elements), describes: advanced.describes }
        : graph;

    // The camera travels rather than jumping, in every mode — a cut is a
    // cut of the WORLD, and re-framing is a separate decision.
    const target: Camera = {
      zoom: 1 + (i % 3) * 0.22,
      x: 0.5 + (i % 2 ? 0.08 : -0.08),
      y: 0.5,
      parallax: 0.15 + (i % 4) * 0.1,
    };
    const path = bridgeCamera(cam, target, mode);

    const b = previous
      ? bridge(previous, scene, mode)
      : { states: [scene], describes: "the film opens" };

    b.states.forEach((s, k) => {
      const c = (path[Math.min(k, path.length - 1)] ?? target) as Camera;
      const nodes = serialiseScene(observe(s, c), MAT);
      out.push({
        mode,
        sentence,
        via: b.states.length > 1 ? `${k + 1}/${b.states.length}` : "",
        decisions: advanced.decisions.map((d) => `${d.identity}:${d.what}`).join(" · "),
        describes: s.describes,
        chain: nodes.map((x) => ({
          id: x.primitiveId,
          params: x.params,
          b: (x.ground ?? []).map((g) => ({ id: g.primitiveId, params: g.params })),
        })),
      });
    });

    cam = target;
    previous = scene;
  });
}

writeFileSync("/tmp/oneshot-out.json", JSON.stringify(out, null, 1));
for (const mode of MODES) {
  const n = out.filter((f) => f.mode === mode).length;
  const cuts = out.filter((f) => f.mode === mode && f.decisions.includes(":CUT")).length;
  console.log(`${mode.padEnd(9)} ${String(n).padStart(3)} states · ${cuts} cut`);
}
