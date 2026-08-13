// The compile pipeline — IR in, build report out.
//
//   parse → solve timing → compose chains → hash nodes → diff the cache
//
// Nothing here calls an AI service. Narration and alignment are frozen
// input artifacts referenced by id; if they're absent the solver falls
// back to nominal windows and flags it, so a film still compiles before a
// single second of TTS has been spent. That is what makes the creative
// loop cheap: dragging a curve costs zero dollars because narration is
// not part of the loop.

import type { EditorialIR } from "../ir/schema.ts";
import {
  type CacheReport,
  type CacheSnapshot,
  diffAgainstSnapshot,
  snapshotFrom,
} from "./cache.ts";
import { type ComposedScene, composeAll } from "./compose.ts";
import { hashSceneNodes } from "./hash.ts";
import { type ShotVariation, planShots } from "./shot-plan.ts";
import { type Alignment, type SolveResult, nominalAlignment, solveTiming } from "./solver.ts";
import { type UsageReport, analyseUsage } from "./usage.ts";

export interface HashedNode {
  primitiveId: string;
  hash: string;
  params: Record<string, number | string>;
  seed: number;
  costMsPerFrame: number;
  reason: string;
}

export interface HashedScene {
  sceneId: string;
  nodes: HashedNode[];
}

/** A scene's shots, with what varies across each cut. Carried on the report
 *  so the Compile view can show the edit, and hashed into the nodes so a
 *  changed cut recomputes only the shots it touched. */
export interface SceneShots {
  sceneId: string;
  shots: ShotVariation[];
}

export interface CompileReport {
  projectId: string;
  timing: SolveResult;
  /** Per-scene cut plans. Empty shots array when a scene is one take. */
  shotPlans: SceneShots[];
  composed: ComposedScene[];
  cache: CacheReport;
  snapshot: CacheSnapshot;
  /** Sum of per-frame cost across the film's most expensive scene — the
   *  number that decides whether this can render in real time. */
  peakCostMsPerFrame: number;
  /** Honest determinism claim for the whole film: the weakest scene. */
  determinism: "L1" | "L2" | "L2-GPU";
  /** Which primitives were load-bearing in this build, so the palette can
   *  be pruned on evidence rather than instinct. */
  usage: UsageReport;
  /** TTS calls this compile made. Structurally always 0 — narration is an
   *  input artifact — and reported so the operator can see that. */
  ttsCalls: 0;
  warnings: string[];
}

export interface CompileOptions {
  alignments?: Map<string, Alignment>;
  snapshot?: CacheSnapshot | null;
}

export async function compile(
  ir: EditorialIR,
  options: CompileOptions = {},
): Promise<CompileReport> {
  // Fall back to nominal alignment for any scene without a frozen one, so
  // an un-narrated film still resolves to real windows.
  const alignments = new Map(options.alignments ?? []);
  let cursor = 0;
  for (const scene of ir.scenes) {
    const nominalMs = Math.max(scene.timing.minDurationMs, 3000);
    if (!alignments.has(scene.sceneId)) {
      alignments.set(scene.sceneId, nominalAlignment(scene, cursor, nominalMs));
    }
    cursor += nominalMs;
  }

  // Cut rhythm is a creative-state parameter like any other, so a director
  // drags it rather than setting a shot length. Sampled at mid-runtime;
  // per-scene rhythm curves are a later refinement.
  const cutRhythm = ir.creativeState.identity.cutRhythm ?? 0;
  const timing = solveTiming(ir, alignments, cutRhythm);
  const composed = composeAll(ir);

  // Plan what varies across each scene's cuts. Intensity rides the film's
  // motion energy, so a director dragging that curve re-cuts the film
  // rather than only re-styling it.
  const shotPlans: SceneShots[] = ir.scenes.map((scene, i) => {
    const solved = timing.scenes.find((s) => s.sceneId === scene.sceneId);
    const shotCount = solved?.shots.length ?? 1;
    const composedScene = composed.find((c) => c.sceneId === scene.sceneId);
    const intensity = composedScene?.state.values.motionEnergy ?? 0.5;
    return {
      sceneId: scene.sceneId,
      shots:
        shotCount > 1
          ? planShots({
              line: scene.narration.text,
              shotCount,
              sceneIndex: i,
              intensity,
              // The hedge reaches all the way here: a claim is not allowed
              // to be dramatised into looking like a finding.
              contested: scene.reading?.contested ?? false,
            })
          : [],
    };
  });

  const hashed: HashedScene[] = [];
  for (const scene of composed) {
    const window = timing.scenes.find((s) => s.sceneId === scene.sceneId);
    const irScene = ir.scenes.find((s) => s.sceneId === scene.sceneId);
    // What this node depends on from the narration. Once narration has
    // been generated the frozen asset's sha256 is the identity. Before
    // that, the narration TEXT stands in for it — otherwise editing a
    // sentence would leave every hash unchanged and the film would
    // silently keep rendering the old cut.
    const assetHashes: string[] = [];
    if (irScene) {
      for (const id of [irScene.narration.voAssetId, irScene.narration.alignmentAssetId]) {
        if (!id) continue;
        assetHashes.push(ir.assets.find((a) => a.assetId === id)?.sha256 ?? id);
      }
      if (!irScene.narration.voAssetId) {
        assetHashes.push(`text:${irScene.narration.text}`);
      }
      // The cut plan is part of what a scene IS. Without it in the hash,
      // re-cutting a scene would leave every node unchanged and the film
      // would keep rendering the old edit — the same class of bug as
      // narration text not reaching the hash.
      const plan = shotPlans.find((sp) => sp.sceneId === irScene.sceneId);
      if (plan && plan.shots.length > 0) {
        assetHashes.push(
          `cut:${plan.shots.map((v) => `${v.text}/${v.mode}/${v.amount}/${v.invert}`).join("|")}`,
        );
      }
    }
    const pairs = await hashSceneNodes(
      scene.nodes,
      { startMs: window?.startMs ?? 0, endMs: window?.endMs ?? 0 },
      assetHashes,
    );
    hashed.push({
      sceneId: scene.sceneId,
      nodes: pairs.map(({ node, hash }) => ({
        primitiveId: node.primitiveId,
        hash,
        params: node.params,
        seed: node.seed,
        costMsPerFrame: node.costMsPerFrame,
        reason: node.reason,
      })),
    });
  }

  const cache = diffAgainstSnapshot(hashed, options.snapshot ?? null);

  // Tensions: an override the engine would otherwise have overruled. The
  // system honours the override and REPORTS this rather than resolving it
  // unilaterally — the difference between an instrument and an automaton.
  const warnings = [...timing.warnings];
  for (const scene of composed) {
    if (scene.override?.type === "pin") {
      const curveAbstraction = scene.state.values.abstraction ?? 0;
      if (Math.abs(curveAbstraction - scene.abstraction) > 0.15 || curveAbstraction > 0.5) {
        warnings.push(
          `PIN ${scene.sceneId} held against a curve asking for abstraction ${curveAbstraction.toFixed(2)}. Not resolved — reported.`,
        );
      }
    }
    for (const hit of scene.ruleHits.filter((h) => h.severity === "soft")) {
      warnings.push(`${scene.sceneId}: soft rule ${hit.ruleId} bit — ${hit.message}`);
    }
    for (const held of scene.state.held) {
      warnings.push(`${scene.sceneId}: invariant held — ${held}`);
    }
  }

  const peakCostMsPerFrame = composed.reduce((max, s) => Math.max(max, s.costMsPerFrame), 0);
  const determinism = composed.some((s) => s.determinism === "L2-GPU")
    ? ("L2-GPU" as const)
    : composed.some((s) => s.determinism === "L2")
      ? ("L2" as const)
      : ("L1" as const);

  return {
    projectId: ir.projectId,
    timing,
    shotPlans,
    composed,
    cache,
    snapshot: snapshotFrom(hashed),
    peakCostMsPerFrame,
    determinism,
    usage: analyseUsage(composed),
    ttsCalls: 0,
    warnings,
  };
}
