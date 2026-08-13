// Narration, as a frozen input artifact.
//
// One operator action → for each scene: speech is synthesised once, the
// bytes are hashed, written to R2 under the Master Spec's key layout,
// recorded as an Asset with its provenance, measured for word timings, and
// the measurement is frozen as a second Asset. The IR then names both by
// id. Nothing downstream ever calls a model again: compile reads the
// stored alignment, and `ttsCalls` on every compile report stays 0 because
// there is structurally nowhere for a TTS call to happen.
//
// The bound is deliberate. An 88-scene film is 176 model calls, which is
// not one request. So this narrates a BOUNDED batch — the same shape
// `/read` uses — and reports exactly which scenes it got to, so the
// operator drives it to completion in visible steps rather than waiting on
// a request that may or may not still be alive.
//
// DEGRADE, FLAG, CONTINUE (standing rule 8). A scene whose synthesis fails
// keeps no asset, keeps its nominal window, and is reported with the
// reason and the shape of whatever came back. The rest of the film
// narrates. A film that is 80% narrated is a film that compiles.

import type { Alignment } from "../compile/solver.ts";
import type { Env } from "../env.ts";
import type { Asset, EditorialIR } from "../ir/schema.ts";
import { newId, nowIso, run } from "../lib/d1.ts";
import { type AlignmentMethod, alignAudio } from "./align.ts";
import { sha256Hex, synthesise } from "./tts.ts";

export interface NarrateOptions {
  /** How many scenes to narrate in this call. */
  limit?: number;
  /** Narrate exactly these, in this order. Overrides the "next un-narrated"
   *  selection — how a single bad take gets re-recorded. */
  sceneIds?: string[];
  /** Re-narrate scenes that already have audio. Off by default: narration
   *  is expensive and already-frozen output is the point. */
  force?: boolean;
  voice?: string;
}

export interface SceneNarration {
  sceneId: string;
  status: "narrated" | "skipped" | "failed";
  label?: string;
  voAssetId?: string;
  alignmentAssetId?: string;
  /** Measured off the audio. This is the number the solver has been
   *  guessing at with character counts since the beginning. */
  durationMs?: number;
  /** What the nominal guess said, so the gap between the estimate and the
   *  measurement is visible rather than silently corrected. */
  nominalMs?: number;
  bytes?: number;
  ttsModel?: string;
  asrModel?: string;
  alignmentMethod?: AlignmentMethod;
  words?: number;
  reason?: string;
  attempts?: Array<{ model: string; outcome: string; shape?: string }>;
}

/** THE ONE STATE THE UI DID NOT HAVE.
 *
 *  A scene whose prose has been edited since its audio was recorded is not
 *  narrated and it is not silent. It is WRONG — the film plays a voice
 *  saying something the frame no longer says, and every other signal in
 *  the system reports it as done.
 *
 *  Checkable exactly, because every audio asset stores the text it was
 *  spoken from. This is the same discipline as the alignment's sha256: the
 *  artifact carries what it was made from, so nothing has to be assumed.
 *
 *   silent   — never recorded
 *   ready    — recorded, and the prose still matches
 *   stale    — recorded from text this scene no longer has
 *   orphaned — named an asset the IR does not contain */
export type VoiceState = "silent" | "ready" | "stale" | "orphaned";

export interface SceneVoice {
  sceneId: string;
  state: VoiceState;
  /** What it was spoken from, when that is no longer what the scene says.
   *  Shown rather than summarised — "stale" is a claim, and the two texts
   *  side by side are the evidence for it. */
  spokenFrom?: string;
}

/** Every scene's voice state, and the film's. */
export function voiceStates(ir: EditorialIR): {
  scenes: SceneVoice[];
  silent: number;
  ready: number;
  stale: number;
} {
  const scenes: SceneVoice[] = ir.scenes.map((scene) => {
    const id = scene.narration.voAssetId;
    if (!id) return { sceneId: scene.sceneId, state: "silent" };
    const asset = ir.assets.find((a) => a.assetId === id);
    if (!asset) return { sceneId: scene.sceneId, state: "orphaned" };
    const spoken = asset.provenance.sourceText;
    // No recorded source text is an OLD asset, not a mismatched one.
    // Treated as ready rather than stale: claiming a scene is wrong on the
    // strength of a missing field would make the state untrustworthy in
    // the direction that matters.
    if (spoken === undefined) return { sceneId: scene.sceneId, state: "ready" };
    if (spoken.trim() === scene.narration.text.trim()) {
      return { sceneId: scene.sceneId, state: "ready" };
    }
    return { sceneId: scene.sceneId, state: "stale", spokenFrom: spoken };
  });
  return {
    scenes,
    silent: scenes.filter((s) => s.state === "silent").length,
    ready: scenes.filter((s) => s.state === "ready").length,
    stale: scenes.filter((s) => s.state === "stale" || s.state === "orphaned").length,
  };
}

export interface NarrateReport {
  scenes: SceneNarration[];
  narrated: number;
  failed: number;
  /** Scenes that still need a voice after this batch — silent ones and
   *  ones whose prose no longer matches what was spoken. */
  remaining: number;
  silent: number;
  stale: number;
  ttsCalls: number;
  asrCalls: number;
  /** Total measured narration time across every narrated scene in the
   *  film, not just this batch. */
  narratedMs: number;
}

const DEFAULT_LIMIT = 6;

export async function narrateScenes(
  env: Env,
  projectId: string,
  ir: EditorialIR,
  version: number,
  options: NarrateOptions = {},
): Promise<{ ir: EditorialIR; report: NarrateReport }> {
  const next: EditorialIR = JSON.parse(JSON.stringify(ir));
  const limit = Math.max(1, Math.min(24, options.limit ?? DEFAULT_LIMIT));

  // STALE SCENES ARE RE-RECORDED WITHOUT BEING ASKED TWICE.
  //
  // "Next un-narrated scene" was the wrong selection: a scene whose prose
  // was edited after recording has audio, so it was skipped forever, and
  // the film kept saying the old sentence. A scene that needs a voice is
  // one that has none OR one whose voice no longer matches its words.
  const voice = new Map(voiceStates(next).scenes.map((s) => [s.sceneId, s.state]));
  const targets = options.sceneIds?.length
    ? next.scenes.filter((s) => options.sceneIds?.includes(s.sceneId))
    : next.scenes.filter((s) => options.force || voice.get(s.sceneId) !== "ready");

  const batch = targets.slice(0, limit);
  const results: SceneNarration[] = [];
  let ttsCalls = 0;
  let asrCalls = 0;

  for (const scene of batch) {
    if (!options.force && options.sceneIds?.length && scene.narration.voAssetId) {
      results.push({ sceneId: scene.sceneId, status: "skipped", reason: "already narrated" });
      continue;
    }

    ttsCalls++;
    const spoken = await synthesise(env.AI, scene.narration.text, options.voice);
    if (!spoken.ok) {
      results.push({
        sceneId: scene.sceneId,
        status: "failed",
        label: scene.label,
        reason: spoken.detail,
        attempts: spoken.attempts,
      });
      continue;
    }

    const audioSha = await sha256Hex(spoken.bytes);
    const audioKey = `projects/${projectId}/vo/${scene.sceneId}_v${version}.${spoken.extension}`;
    await env.FILES.put(
      audioKey,
      spoken.bytes.buffer.slice(
        spoken.bytes.byteOffset,
        spoken.bytes.byteOffset + spoken.bytes.byteLength,
      ) as ArrayBuffer,
      { httpMetadata: { contentType: spoken.contentType } },
    );

    const voAsset: Asset = {
      assetId: newId("ast"),
      kind: "audio",
      r2Key: audioKey,
      sha256: audioSha,
      provenance: {
        generatedBy: spoken.model,
        params: {
          via: spoken.via,
          contentType: spoken.contentType,
          bytes: spoken.bytes.length,
          voice: options.voice ?? "default",
        },
        createdAt: nowIso(),
        sourceText: scene.narration.text,
      },
    };
    await recordAsset(env, projectId, voAsset);

    asrCalls++;
    const aligned = await alignAudio(env.AI, spoken.bytes, scene.sceneId, scene.narration.text);

    scene.narration.voAssetId = voAsset.assetId;
    next.assets.push(voAsset);

    if (!aligned.ok || !aligned.alignment) {
      // Audio exists, timings do not. The scene keeps its nominal window
      // and says so — which is more useful than discarding good audio
      // because the measurement failed.
      results.push({
        sceneId: scene.sceneId,
        status: "narrated",
        label: scene.label,
        voAssetId: voAsset.assetId,
        bytes: spoken.bytes.length,
        ttsModel: spoken.model,
        alignmentMethod: "declined",
        nominalMs: scene.timing.minDurationMs,
        reason: aligned.reason ?? "alignment declined — nominal window retained",
        attempts: aligned.attempts,
      });
      continue;
    }

    const alignJson = JSON.stringify({
      sceneId: scene.sceneId,
      method: aligned.method,
      model: aligned.model,
      durationMs: aligned.durationMs,
      chunks: aligned.alignment.chunks,
    });
    const alignSha = await sha256Hex(alignJson);
    const alignKey = `projects/${projectId}/alignment/${scene.sceneId}_v${version}.json`;
    await env.FILES.put(alignKey, alignJson, {
      httpMetadata: { contentType: "application/json" },
    });

    const alignAsset: Asset = {
      assetId: newId("ast"),
      kind: "alignment",
      r2Key: alignKey,
      sha256: alignSha,
      provenance: {
        generatedBy: aligned.model ?? "unknown",
        params: {
          method: aligned.method,
          words: aligned.words ?? 0,
          durationMs: aligned.durationMs,
          measuredFrom: voAsset.assetId,
        },
        createdAt: nowIso(),
        sourceText: scene.narration.text,
      },
    };
    await recordAsset(env, projectId, alignAsset);

    scene.narration.alignmentAssetId = alignAsset.assetId;
    next.assets.push(alignAsset);

    results.push({
      sceneId: scene.sceneId,
      status: "narrated",
      label: scene.label,
      voAssetId: voAsset.assetId,
      alignmentAssetId: alignAsset.assetId,
      durationMs: aligned.durationMs,
      nominalMs: scene.timing.minDurationMs,
      bytes: spoken.bytes.length,
      ttsModel: spoken.model,
      ...(aligned.model ? { asrModel: aligned.model } : {}),
      alignmentMethod: aligned.method,
      words: aligned.words ?? 0,
    });
  }

  const narrated = results.filter((r) => r.status === "narrated").length;
  const after = voiceStates(next);
  const remaining = after.silent + after.stale;
  const narratedMs = results.reduce((a, r) => a + (r.durationMs ?? 0), 0);

  return {
    ir: next,
    report: {
      scenes: results,
      narrated,
      failed: results.filter((r) => r.status === "failed").length,
      remaining,
      silent: after.silent,
      stale: after.stale,
      ttsCalls,
      asrCalls,
      narratedMs,
    },
  };
}

async function recordAsset(env: Env, projectId: string, asset: Asset): Promise<void> {
  await run(
    env.DB,
    `INSERT INTO assets (id, project_id, kind, r2_key, sha256, provenance_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      asset.assetId,
      projectId,
      asset.kind,
      asset.r2Key,
      asset.sha256,
      JSON.stringify(asset.provenance),
      nowIso(),
    ],
  );
}

/** Load every frozen alignment this film has, SCENE-LOCAL.
 *
 *  The sha256 on the asset is what makes a frozen artifact trustworthy, so
 *  it is verified rather than assumed: an object whose bytes no longer
 *  hash to what was approved is ignored and the scene falls back to its
 *  nominal window. A silently swapped artifact would re-time a film
 *  without anything saying so, which is the exact failure the hash exists
 *  to prevent. */
export async function loadAlignments(
  env: Env,
  ir: EditorialIR,
): Promise<{ alignments: Map<string, Alignment>; stale: string[] }> {
  const alignments = new Map<string, Alignment>();
  const stale: string[] = [];

  // FETCHED IN PARALLEL, NOT ONE AT A TIME.
  //
  // This was a sequential loop: one R2 round trip and one SHA-256 per
  // scene, awaited in order. On a sixty-one scene film that is sixty-one
  // serial round trips inside a single request, and a compile that should
  // take a second took long enough to look hung. The verification is not
  // optional — a swapped artifact must not re-time a film silently — but
  // nothing about it needs to happen in sequence.
  const loaded = await Promise.all(
    ir.scenes.map(async (scene) => {
      const id = scene.narration.alignmentAssetId;
      if (!id) return null;
      const asset = ir.assets.find((a) => a.assetId === id);
      if (!asset) {
        return { error: `${scene.sceneId}: alignment asset ${id} is not in the IR` };
      }
      const obj = await env.FILES.get(asset.r2Key);
      if (!obj) {
        return {
          error: `${scene.sceneId}: alignment object ${asset.r2Key} is missing from storage`,
        };
      }
      const text = await obj.text();
      const actual = await sha256Hex(text);
      if (actual !== asset.sha256) {
        return { error: `${scene.sceneId}: alignment bytes do not match the approved hash` };
      }
      const parsed = JSON.parse(text) as { chunks?: Alignment["chunks"] };
      if (!parsed.chunks?.length) {
        return { error: `${scene.sceneId}: alignment artifact has no chunks` };
      }
      return { sceneId: scene.sceneId, chunks: parsed.chunks };
    }),
  );

  // Collected in the IR's scene order, because `sequenceAlignments` walks
  // that order and a Map built from a race would still be correct but
  // would make a diff of this function's output depend on timing.
  for (const entry of loaded) {
    if (!entry) continue;
    if ("error" in entry) {
      stale.push(entry.error);
      continue;
    }
    alignments.set(entry.sceneId, { sceneId: entry.sceneId, chunks: entry.chunks });
  }

  return { alignments, stale };
}
