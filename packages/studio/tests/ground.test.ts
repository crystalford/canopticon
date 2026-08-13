// The second input, as executable checks.
//
// A chain is a line and expresses one relation: "then". The whole reason
// this exists is the other relation — AND — and the assertions that matter
// are the ones that would catch it quietly not happening:
//
//   THE GROUND REACHES THE HASH. A node whose ground changed paints
//   something different. If the hash does not move, the film keeps
//   rendering the old layer and nothing says so. This is the same class of
//   bug as narration text not reaching the hash, and it is silent in
//   exactly the same way.
//
//   THE GROUND COSTS WHAT IT COSTS. It is a whole second chain rendered
//   every frame. A two-layer scene that reports the same cost as a
//   one-layer scene has turned its own budget into a decoration.
//
//   A FIELD COMPOSITOR REFUSES A GROUND THAT IS NOT A FIELD.
//   `field_displace` reads a field's NUMBERS. A branch that only paints a
//   picture of a field would silently do nothing, which is the failure
//   this family was built to end — so it is refused, loudly, at plan time.
//
//   A CONTESTED LINE IS NOT DRAMATISED. Standing discipline in this
//   compiler. Erosion and displacement are the two most rhetorical
//   operations in the palette and a claim does not get either.

import { describe, expect, it } from "vitest";
import { composeAll } from "../src/compile/compose.ts";
import { groundSatisfies, planGround } from "../src/compile/ground.ts";
import { hashPayload, nodeHash } from "../src/compile/hash.ts";
import { compile } from "../src/compile/index.ts";
import { parseIR } from "../src/ir/schema.ts";
import { PRIMITIVES } from "../src/primitives/registry.ts";
import { buildFixtureIR } from "./fixture.ts";
import { must } from "./must.ts";

const BASE = {
  chain: ["document_surface", "camera_move"],
  tier: "GROUNDED" as const,
  density: 0.7,
  motionEnergy: 0.5,
  experimentalism: 0.4,
  restraint: 0.3,
  contested: false,
  pinned: false,
  sceneIndex: 0,
  budgetMs: 64,
};

describe("the compositing family exists and is typed", () => {
  it("declares five two-input primitives", () => {
    const two = Object.values(PRIMITIVES).filter((p) => p.secondInput);
    expect(two.length).toBe(5);
    expect(two.every((p) => p.family === "M · COMPOSITING")).toBe(true);
  });

  it("types the two field compositors on their SECOND input, not their first", () => {
    expect(must(PRIMITIVES.field_displace).secondInput).toBe("FIELD");
    expect(must(PRIMITIVES.field_erode).secondInput).toBe("FIELD");
    expect(must(PRIMITIVES.layer_over).secondInput).toBe("IMAGE");
  });

  it("every compositor actually reads what it is handed", () => {
    for (const p of Object.values(PRIMITIVES).filter((x) => x.secondInput)) {
      expect(p.consumesUpstream).toBe(true);
    }
  });

  it("gravity_field emits a real field, not only a picture of one", () => {
    // It declared "— → FIELD" and returned nothing for the whole life of
    // the palette, so its own note described something that did not exist.
    expect(must(PRIMITIVES.gravity_field).outputs).toContain("FIELD");
  });
});

describe("planning a ground", () => {
  it("puts a picture behind a dense scene", () => {
    const plan = must(planGround(BASE));
    expect(plan.compositor).toBe("layer_over");
    expect(plan.ground.length).toBeGreaterThan(0);
  });

  it("lets a field move the image when the film is decomposed and moving", () => {
    const plan = must(planGround({ ...BASE, tier: "DECOMPOSED", motionEnergy: 0.8 }));
    expect(plan.compositor).toBe("field_displace");
    expect(groundSatisfies(plan.compositor, plan.ground)).toBe(true);
  });

  it("eats the image in the shape of the field at the top of the ladder", () => {
    const plan = must(planGround({ ...BASE, tier: "DISSOLVED" }));
    expect(plan.compositor).toBe("field_erode");
  });

  it("holds a contested line flat — no erosion, no displacement", () => {
    const dissolved = planGround({ ...BASE, tier: "DISSOLVED", contested: true });
    expect(dissolved?.compositor).not.toBe("field_erode");
    const moving = planGround({
      ...BASE,
      tier: "DECOMPOSED",
      motionEnergy: 0.9,
      contested: true,
    });
    expect(moving?.compositor).not.toBe("field_displace");
  });

  it("refuses to add a layer to a scene the director asked to keep restrained", () => {
    expect(planGround({ ...BASE, restraint: 0.9 })).toBe(null);
  });

  it("never touches a pinned scene", () => {
    expect(planGround({ ...BASE, pinned: true })).toBe(null);
  });

  it("refuses when there is no stage to composite over at all", () => {
    expect(planGround({ ...BASE, chain: [] })).toBe(null);
    expect(planGround({ ...BASE, chain: ["not_a_primitive"] })).toBe(null);
  });

  it("composes after a chain that ends in GEOMETRY — a compositor takes pixels", () => {
    // Most real chains end in GEOMETRY or ANIMATION, not IMAGE. Requiring
    // IMAGE on the A side made grounds fire almost never, which would have
    // shipped the feature as theatre.
    const plan = planGround({ ...BASE, chain: ["text_layout", "particle_seek"] });
    expect(plan).not.toBe(null);
  });

  it("refuses when the ground would not fit the frame budget", () => {
    expect(planGround({ ...BASE, budgetMs: 1 })).toBe(null);
  });

  it("rotates the ground so neighbouring scenes do not share a bed", () => {
    const a = must(planGround({ ...BASE, sceneIndex: 0 })).ground.join();
    const b = must(planGround({ ...BASE, sceneIndex: 1 })).ground.join();
    expect(a).not.toBe(b);
  });

  it("is deterministic — the same inputs always plan the same ground", () => {
    expect(JSON.stringify(planGround({ ...BASE, sceneIndex: 5 }))).toBe(
      JSON.stringify(planGround({ ...BASE, sceneIndex: 5 })),
    );
  });
});

describe("a ground that cannot satisfy its compositor is refused", () => {
  it("rejects a field compositor over a ground that only paints", () => {
    const said = groundSatisfies("field_displace", ["plate_scene"]);
    expect(said).not.toBe(true);
    expect(String(said)).toContain("needs a FIELD");
  });

  it("accepts any ground for a pixels compositor, and says why it does", () => {
    // IMAGE means pixels, and every primitive produces pixels. Enforcing
    // an IMAGE second input would be theatre.
    expect(groundSatisfies("layer_over", ["data_series"])).toBe(true);
  });
});

describe("the ground reaches the hash", () => {
  it("moves the node hash when the ground changes", async () => {
    const node = {
      primitiveId: "layer_over",
      params: { opacity: 0.5 },
      seed: 1,
      startMs: 0,
      endMs: 1000,
      assetHashes: [],
    };
    const a = await nodeHash({ ...node, ground: ["noise_field#1#{}"] });
    const b = await nodeHash({ ...node, ground: ["gravity_field#1#{}"] });
    expect(a).not.toBe(b);
  });

  it("does not sort the ground — a chain is ordered", () => {
    const one = hashPayload({
      primitiveId: "layer_over",
      params: {},
      seed: 1,
      startMs: 0,
      endMs: 1,
      assetHashes: [],
      ground: ["noise_field", "flow_field"],
    });
    const other = hashPayload({
      primitiveId: "layer_over",
      params: {},
      seed: 1,
      startMs: 0,
      endMs: 1,
      assetHashes: [],
      ground: ["flow_field", "noise_field"],
    });
    expect(one).not.toBe(other);
  });

  it("leaves a one-input node's hash unchanged by the feature existing", async () => {
    const node = {
      primitiveId: "camera_move",
      params: { push: 0.4 },
      seed: 3,
      startMs: 0,
      endMs: 900,
      assetHashes: [],
    };
    expect(await nodeHash(node)).toBe(await nodeHash({ ...node, ground: [] }));
  });
});

describe("a composed film with grounds", () => {
  it("carries the ground on the compositor and nowhere else", () => {
    const parsed = parseIR(buildFixtureIR());
    if (!parsed.ok) throw new Error("fixture is invalid");
    const scenes = composeAll(parsed.ir);
    for (const scene of scenes) {
      for (const node of scene.nodes) {
        if (!node.ground) continue;
        expect(PRIMITIVES[node.primitiveId]?.secondInput).toBeTruthy();
        expect(node.ground.length).toBeGreaterThan(0);
        // Seeded away from the subject chain's range. Two layers seeded
        // identically move in lockstep and read as one image.
        for (const g of node.ground) expect(g.seed).toBeGreaterThanOrEqual(7000);
      }
    }
  });

  it("counts the ground's cost as the scene's cost", () => {
    const parsed = parseIR(buildFixtureIR());
    if (!parsed.ok) throw new Error("fixture is invalid");
    for (const scene of composeAll(parsed.ir)) {
      const grounded = scene.nodes.find((n) => n.ground);
      if (!grounded) continue;
      const own = scene.nodes.reduce((a, n) => a + n.costMsPerFrame, 0);
      expect(scene.costMsPerFrame).toBeGreaterThanOrEqual(own);
    }
  });

  it("reports grounds in the usage report as real links, not decorative ones", async () => {
    const parsed = parseIR(buildFixtureIR());
    if (!parsed.ok) throw new Error("fixture is invalid");
    const report = await compile(parsed.ir);
    if (report.usage.groundedScenes === 0) return;
    expect(report.usage.grounds.length).toBeGreaterThan(0);
    expect(must(report.usage.grounds[0]).link).toContain("⊕");
    // A ground primitive is a USE. A palette pruned on evidence must not
    // call a primitive unused because it only ever appears on a B side.
    const groundIds = report.composed
      .flatMap((s) => s.nodes)
      .flatMap((n) => n.ground ?? [])
      .map((g) => g.primitiveId);
    for (const id of groundIds) {
      expect(report.usage.primitives.some((p) => p.primitiveId === id)).toBe(true);
    }
  });

  it("hands the ground to the browser on the film plan", async () => {
    const parsed = parseIR(buildFixtureIR());
    if (!parsed.ok) throw new Error("fixture is invalid");
    const report = await compile(parsed.ir);
    const { buildFilmPlan } = await import("../src/compile/film.ts");
    const plan = buildFilmPlan(parsed.ir, report);
    for (const scene of plan.scenes) {
      for (const node of scene.chain) {
        if (!node.b) continue;
        expect(node.b.length).toBeGreaterThan(0);
        expect(PRIMITIVES[node.id]?.secondInput).toBeTruthy();
      }
    }
  });
});
