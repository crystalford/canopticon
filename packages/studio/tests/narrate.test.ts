// Narration, as executable checks.
//
// The interesting assertions here are not "TTS was called". They are:
//
//   THE SHAPE IS NOT ASSUMED. Workers AI has returned audio as a stream,
//   as a buffer, and as a base64 string under `audio`. All three are
//   recovered, and a candidate that throws costs the next candidate rather
//   than the feature. This is the direct lesson of the extraction bug —
//   an unverified assumption about a response shape that survived because
//   the failure looked exactly like designed behaviour.
//
//   NARRATION ACTUALLY RE-TIMES THE FILM. Before this existed every scene
//   carried a `missing_alignment` flag and a character-count guess at its
//   duration. The test that matters is that a frozen alignment removes the
//   flag AND moves the window to the measured time — because an alignment
//   artifact that does not change the cut is an artifact that does
//   nothing.
//
//   THE ANCHORS THE SEGMENTER AUTHORED RESOLVE. The segmenter writes
//   `{sceneId}_start` / `{sceneId}_end` before narration exists. If the
//   artifact does not carry those two ids the anchors still don't resolve
//   and narration changes nothing at all — silently. That is one line of
//   code and it is load-bearing for the entire feature.

import { describe, expect, it } from "vitest";
import { compile } from "../src/compile/index.ts";
import { type Alignment, solveTiming } from "../src/compile/solver.ts";
import { parseIR } from "../src/ir/schema.ts";
import {
  chunksFromDuration,
  chunksFromWords,
  readTimings,
  sequenceAlignments,
  withEndpoints,
} from "../src/narrate/align.ts";
import { narrateScenes } from "../src/narrate/index.ts";
import {
  describeShape,
  fromBase64,
  sniff,
  synthesise,
  toBase64,
  toBytes,
} from "../src/narrate/tts.ts";
import { buildFixtureIR } from "./fixture.ts";
import { must } from "./must.ts";

const MP3 = new Uint8Array([0xff, 0xfb, 0x90, 0x64, 0x00, 0x01, 0x02, 0x03]);
const WAV = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00]);

function fakeAi(handler: (model: string, input: Record<string, unknown>) => unknown) {
  const calls: Array<{ model: string; input: Record<string, unknown> }> = [];
  return {
    calls,
    run: async (model: string, input: Record<string, unknown>) => {
      calls.push({ model, input });
      const out = handler(model, input);
      if (out instanceof Error) throw out;
      return out;
    },
  };
}

describe("recovering audio from whatever the binding returned", () => {
  it("reads a Uint8Array", async () => {
    expect((await toBytes(MP3))?.via).toBe("Uint8Array");
  });

  it("reads an ArrayBuffer", async () => {
    const got = await toBytes(MP3.buffer.slice(0));
    expect(got?.via).toBe("ArrayBuffer");
    expect(got?.bytes.length).toBe(MP3.length);
  });

  it("reads a base64 string under `audio`, and says so", async () => {
    const long = new Uint8Array(64).fill(0xff);
    long[0] = 0xff;
    long[1] = 0xfb;
    const got = await toBytes({ audio: toBase64(long) });
    expect(got?.via).toBe("object.audio → base64 string");
    expect(got?.bytes.length).toBe(64);
  });

  it("reads a stream", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(MP3.subarray(0, 4));
        controller.enqueue(MP3.subarray(4));
        controller.close();
      },
    });
    const got = await toBytes(stream);
    expect(got?.via).toBe("ReadableStream");
    expect(got?.bytes.length).toBe(8);
  });

  it("returns null — not a throw — for prose where audio was expected", async () => {
    expect(await toBytes({ response: "I cannot generate audio." })).toBe(null);
    expect(fromBase64("nope")).toBe(null);
  });

  it("reads the format off the bytes rather than trusting the model", () => {
    expect(sniff(MP3).extension).toBe("mp3");
    expect(sniff(WAV).contentType).toBe("audio/wav");
    expect(sniff(new Uint8Array([1, 2, 3, 4])).extension).toBe("bin");
  });

  it("describes an unrecognised shape well enough to debug from a probe", () => {
    const said = describeShape({ response: "hello", segments: [1, 2] });
    expect(said).toContain("response: string(5)");
    expect(said).toContain("segments: array(2)");
  });
});

describe("synthesis", () => {
  it("falls through to the next candidate when one throws, and records both", async () => {
    const ai = fakeAi((model) =>
      model.includes("deepgram") ? new Error("no such model") : { audio: toBase64(pad(MP3)) },
    );
    const got = await synthesise(ai, "One line of narration.");
    expect(got.ok).toBe(true);
    if (got.ok) {
      expect(got.model).toContain("melotts");
      expect(got.contentType).toBe("audio/mpeg");
    }
    expect(ai.calls.length).toBe(2);
  });

  it("reports the shape it could not use rather than a bare failure", async () => {
    const ai = fakeAi(() => ({ response: "here is your audio" }));
    const got = await synthesise(ai, "A line.");
    expect(got.ok).toBe(false);
    if (!got.ok) {
      expect(got.reason).toBe("no-audio");
      expect(got.attempts.length).toBe(2);
      expect(must(got.attempts[0]).shape).toContain("response: string");
    }
  });

  it("says plainly when there is no binding at all", async () => {
    const got = await synthesise(undefined, "A line.");
    expect(got.ok).toBe(false);
    if (!got.ok) expect(got.reason).toBe("no-binding");
  });
});

describe("reading timings out of an ASR response", () => {
  it("reads whisper's flat word list, in seconds", () => {
    const got = readTimings({
      text: "one two",
      words: [
        { word: "one", start: 0, end: 0.5 },
        { word: "two", start: 0.5, end: 1.25 },
      ],
    });
    expect(got.words.length).toBe(2);
    expect(got.durationMs).toBe(1250);
  });

  it("reads words nested in segments, and a declared duration", () => {
    const got = readTimings({
      segments: [{ start: 0, end: 2, text: "a b", words: [{ word: "a", start: 0, end: 1 }] }],
      transcription_info: { duration: 2.4 },
    });
    expect(got.words.length).toBe(1);
    expect(got.durationMs).toBe(2400);
  });

  it("returns nothing usable rather than inventing a duration", () => {
    expect(readTimings({ text: "no timings here" }).durationMs).toBe(0);
    expect(readTimings("a string").durationMs).toBe(0);
  });
});

describe("chunking", () => {
  const text = "First sentence here. Second sentence, a bit longer than the first one.";

  it("tiles the scene with no gaps and no overlaps", () => {
    const words = Array.from({ length: 12 }, (_, i) => ({
      word: `w${i}`,
      startMs: i * 400,
      endMs: (i + 1) * 400,
    }));
    const chunks = chunksFromWords("s001", text, words);
    expect(chunks.length).toBe(2);
    for (let i = 1; i < chunks.length; i++) {
      expect(must(chunks[i]).startMs).toBe(must(chunks[i - 1]).endMs);
    }
    expect(must(chunks[0]).startMs).toBe(0);
    expect(must(chunks[chunks.length - 1]).endMs).toBe(4800);
  });

  it("still uses the MEASURED duration when there are no word timings", () => {
    const chunks = chunksFromDuration("s001", text, 6000);
    expect(chunks.length).toBe(2);
    expect(must(chunks[chunks.length - 1]).endMs).toBe(6000);
  });

  it("carries the two chunk ids the segmenter's anchors already name", () => {
    const alignment = withEndpoints("s001", chunksFromDuration("s001", text, 6000));
    const ids = alignment.chunks.map((c) => c.chunkId);
    expect(ids).toContain("s001_start");
    expect(ids).toContain("s001_end");
    expect(must(alignment.chunks.find((c) => c.chunkId === "s001_start")).startMs).toBe(0);
    expect(must(alignment.chunks.find((c) => c.chunkId === "s001_end")).endMs).toBe(6000);
  });
});

describe("placing scene-local alignments on the film's timeline", () => {
  it("sequences by the IR's scene order, not the map's", () => {
    const scenes = [
      { sceneId: "s001", timing: { minDurationMs: 3000 } },
      { sceneId: "s002", timing: { minDurationMs: 3000 } },
    ];
    const local = new Map<string, Alignment>([
      ["s002", withEndpoints("s002", [{ chunkId: "s002_c1", startMs: 0, endMs: 4000 }])],
      ["s001", withEndpoints("s001", [{ chunkId: "s001_c1", startMs: 0, endMs: 5000 }])],
    ]);
    const placed = sequenceAlignments(scenes, local);
    expect(must(must(placed.get("s001")).chunks[0]).startMs).toBe(0);
    expect(must(must(placed.get("s002")).chunks[0]).startMs).toBe(5000);
  });

  it("advances past an un-narrated scene so the narrated ones stay in place", () => {
    const scenes = [
      { sceneId: "s001", timing: { minDurationMs: 4000 } },
      { sceneId: "s002", timing: { minDurationMs: 3000 } },
    ];
    const local = new Map<string, Alignment>([
      ["s002", withEndpoints("s002", [{ chunkId: "s002_c1", startMs: 0, endMs: 2000 }])],
    ]);
    const placed = sequenceAlignments(scenes, local);
    expect(placed.has("s001")).toBe(false);
    expect(must(must(placed.get("s002")).chunks[0]).startMs).toBe(4000);
  });
});

describe("a frozen alignment actually re-times the film", () => {
  it("clears missing_alignment and moves the window to the measured time", () => {
    const ir = must(parseFixture());
    const scene = must(ir.scenes[0]);
    // What the segmenter authored: anchors that do not resolve yet.
    scene.timing.startAnchor = { chunkId: `${scene.sceneId}_start`, offsetMs: 0 };
    scene.timing.endAnchor = { chunkId: `${scene.sceneId}_end`, offsetMs: 0 };
    scene.timing.minDurationMs = 0;

    const before = solveTiming(ir, new Map(), 0);
    expect(must(before.scenes[0]).flags).toContain("missing_alignment");

    const measured = 7400;
    const alignment = withEndpoints(scene.sceneId, [
      { chunkId: `${scene.sceneId}_c1`, startMs: 0, endMs: measured },
    ]);
    const after = solveTiming(ir, new Map([[scene.sceneId, alignment]]), 0);
    const solved = must(after.scenes[0]);
    expect(solved.flags).not.toContain("missing_alignment");
    expect(solved.durationMs).toBe(measured);
  });
});

describe("narrating a project", () => {
  it("freezes audio and alignment as assets and names them on the scene", async () => {
    const ir = must(parseFixture());
    const env = fakeEnv((model, input) => {
      if (model.includes("whisper")) {
        return {
          words: [
            { word: "a", start: 0, end: 1 },
            { word: "b", start: 1, end: 2.5 },
          ],
        };
      }
      expect(typeof input).toBe("object");
      return { audio: toBase64(pad(MP3)) };
    });

    const { ir: next, report } = await narrateScenes(env.env, "proj_x", ir, 2, { limit: 1 });
    expect(report.narrated).toBe(1);
    expect(report.ttsCalls).toBe(1);
    expect(report.asrCalls).toBe(1);

    const scene = must(next.scenes[0]);
    expect(scene.narration.voAssetId).toBeTruthy();
    expect(scene.narration.alignmentAssetId).toBeTruthy();
    expect(next.assets.length).toBe(2);

    // The audio asset's provenance names the model and how the bytes were
    // recovered — the two facts that would otherwise have to be guessed.
    const audio = must(next.assets.find((a) => a.kind === "audio"));
    expect(audio.provenance.generatedBy).toContain("@cf/");
    expect(String(audio.provenance.params.via)).toContain("base64");
    expect(audio.sha256).toMatch(/^[0-9a-f]{64}$/);

    // Both objects are in storage under the Master Spec key layout.
    expect([...env.bucket.keys()].some((k) => k.startsWith("projects/proj_x/vo/"))).toBe(true);
    expect([...env.bucket.keys()].some((k) => k.startsWith("projects/proj_x/alignment/"))).toBe(
      true,
    );
  });

  it("keeps the audio when the alignment fails, and says the window is nominal", async () => {
    const ir = must(parseFixture());
    const env = fakeEnv((model) =>
      model.includes("whisper") ? { text: "no timings" } : { audio: toBase64(pad(MP3)) },
    );
    const { ir: next, report } = await narrateScenes(env.env, "proj_x", ir, 2, { limit: 1 });
    const line = must(report.scenes[0]);
    expect(line.status).toBe("narrated");
    expect(line.alignmentMethod).toBe("declined");
    expect(must(next.scenes[0]).narration.voAssetId).toBeTruthy();
    expect(must(next.scenes[0]).narration.alignmentAssetId).toBeUndefined();
  });

  it("degrades one scene rather than the batch when synthesis fails", async () => {
    const ir = must(parseFixture());
    let call = 0;
    const env = fakeEnv((model) => {
      if (model.includes("whisper")) return { words: [{ word: "a", start: 0, end: 2 }] };
      call++;
      // Both TTS candidates fail for the first scene only.
      if (call <= 2) return new Error("upstream unavailable");
      return { audio: toBase64(pad(MP3)) };
    });
    const { report } = await narrateScenes(env.env, "proj_x", ir, 2, { limit: 2 });
    expect(report.failed).toBe(1);
    expect(report.narrated).toBe(1);
    expect(must(report.scenes[0]).attempts?.length).toBe(2);
  });

  it("does not re-narrate an already-frozen scene", async () => {
    const ir = must(parseFixture());
    const env = fakeEnv((model) =>
      model.includes("whisper")
        ? { words: [{ word: "a", start: 0, end: 2 }] }
        : { audio: toBase64(pad(MP3)) },
    );
    const first = await narrateScenes(env.env, "proj_x", ir, 2, { limit: 1 });
    const second = await narrateScenes(env.env, "proj_x", first.ir, 3, { limit: 1 });
    expect(must(second.report.scenes[0]).sceneId).not.toBe(must(first.report.scenes[0]).sceneId);
  });

  it("compiles with real alignments and spends no TTS doing it", async () => {
    const ir = must(parseFixture());
    for (const scene of ir.scenes) {
      scene.timing.startAnchor = { chunkId: `${scene.sceneId}_start`, offsetMs: 0 };
      scene.timing.endAnchor = { chunkId: `${scene.sceneId}_end`, offsetMs: 0 };
      scene.timing.minDurationMs = 0;
    }
    const alignments = sequenceAlignments(
      ir.scenes,
      new Map(
        ir.scenes.map((s) => [
          s.sceneId,
          withEndpoints(s.sceneId, [{ chunkId: `${s.sceneId}_c1`, startMs: 0, endMs: 5000 }]),
        ]),
      ),
    );
    const report = await compile(ir, { alignments });
    expect(report.ttsCalls).toBe(0);
    expect(report.timing.scenes.every((s) => !s.flags.includes("missing_alignment"))).toBe(true);
    expect(must(report.timing.scenes[0]).durationMs).toBe(5000);
  });
});

/** Padded so it clears the base64 minimum-length guard, which exists so a
 *  model that answered with the word "ok" is not read as four bytes of
 *  audio. */
function pad(head: Uint8Array): Uint8Array {
  const out = new Uint8Array(96);
  out.set(head, 0);
  return out;
}

function parseFixture() {
  const parsed = parseIR(buildFixtureIR());
  return parsed.ok ? parsed.ir : null;
}

/** A D1 + R2 + AI stand-in that records what was written. Small on
 *  purpose: the point is to assert the artifact layout, not to reimplement
 *  Cloudflare. */
function fakeEnv(handler: (model: string, input: Record<string, unknown>) => unknown) {
  const bucket = new Map<string, string | ArrayBuffer>();
  const rows: unknown[][] = [];
  const env = {
    DB: {
      prepare: (_sql: string) => ({
        bind: (...args: unknown[]) => ({
          run: async () => {
            rows.push(args);
            return { success: true };
          },
          first: async () => null,
          all: async () => ({ results: [] }),
        }),
        run: async () => ({ success: true }),
        first: async () => null,
        all: async () => ({ results: [] }),
      }),
    },
    FILES: {
      put: async (key: string, value: string | ArrayBuffer) => {
        bucket.set(key, value);
      },
      get: async (key: string) => {
        const found = bucket.get(key);
        if (found === undefined) return null;
        return {
          text: async () => (typeof found === "string" ? found : ""),
          json: async () => JSON.parse(typeof found === "string" ? found : "{}"),
          arrayBuffer: async () => (typeof found === "string" ? new ArrayBuffer(0) : found),
        };
      },
    },
    AI: {
      run: async (model: string, input: Record<string, unknown>) => {
        const out = handler(model, input);
        if (out instanceof Error) throw out;
        return out;
      },
    },
  };
  // The narration module only ever touches DB/FILES/AI; the cast keeps the
  // fake honest about that rather than stubbing an entire Env.
  return { env: env as unknown as import("../src/env.ts").Env, bucket, rows };
}

describe("audio that no longer matches its own words", () => {
  it("calls a scene stale when the prose moved after recording", async () => {
    const { voiceStates } = await import("../src/narrate/index.ts");
    const ir = must(parseFixture());
    const env = fakeEnv((model) =>
      model.includes("whisper")
        ? { words: [{ word: "a", start: 0, end: 2 }] }
        : { audio: toBase64(pad(MP3)) },
    );
    const { ir: narrated } = await narrateScenes(env.env, "p", ir, 2, { limit: 1 });
    expect(voiceStates(narrated).ready).toBe(1);
    expect(voiceStates(narrated).stale).toBe(0);

    // The author rewrites the sentence. The audio is now wrong — not
    // missing, wrong — and nothing else in the system would have said so.
    must(narrated.scenes[0]).narration.text = "A completely different sentence entirely.";
    const after = voiceStates(narrated);
    expect(after.stale).toBe(1);
    expect(after.ready).toBe(0);
    expect(must(after.scenes[0]).spokenFrom).toBeTruthy();
  });

  it("re-records a stale scene without being asked twice", async () => {
    const ir = must(parseFixture());
    const env = fakeEnv((model) =>
      model.includes("whisper")
        ? { words: [{ word: "a", start: 0, end: 2 }] }
        : { audio: toBase64(pad(MP3)) },
    );
    const first = await narrateScenes(env.env, "p", ir, 2, { limit: 1 });
    must(first.ir.scenes[0]).narration.text = "Rewritten.";

    // "Next un-narrated scene" would skip this forever, and the film would
    // keep saying the old sentence.
    const second = await narrateScenes(env.env, "p", first.ir, 3, { limit: 1 });
    expect(must(second.report.scenes[0]).sceneId).toBe(must(first.ir.scenes[0]).sceneId);
    expect(second.report.narrated).toBe(1);
  });

  it("does not call an old asset stale merely for lacking a source text", async () => {
    const { voiceStates } = await import("../src/narrate/index.ts");
    const ir = must(parseFixture());
    const scene = must(ir.scenes[0]);
    scene.narration.voAssetId = "ast_old";
    ir.assets.push({
      assetId: "ast_old",
      kind: "audio",
      r2Key: "k",
      sha256: "x",
      provenance: { generatedBy: "old", params: {}, createdAt: "2020-01-01" },
    });
    expect(voiceStates(ir).stale).toBe(0);
  });
});

describe("the film does not talk over itself", () => {
  // Reported from a real film: "the tts overlaps... a little bit jarring."
  //
  // The cascade closes gaps by moving a scene's head and keeping its tail,
  // which SHORTENS it. Correct for a procedural visual, which simply runs
  // for less time; wrong for narration, which does not compress.
  it("never shortens a narrated scene below its own measured audio", () => {
    const ir = must(parseFixture());
    for (const scene of ir.scenes) {
      scene.timing.startAnchor = { chunkId: `${scene.sceneId}_start`, offsetMs: 0 };
      scene.timing.endAnchor = { chunkId: `${scene.sceneId}_end`, offsetMs: 0 };
      scene.timing.elasticity = "elastic";
      scene.timing.minDurationMs = 0;
    }

    // Uneven measured durations, which is what real speech looks like and
    // what makes the cascade fire.
    const measured = [7000, 2600, 9100, 3400, 5200];
    const local = new Map(
      ir.scenes.map((s, i) => [
        s.sceneId,
        withEndpoints(s.sceneId, [
          {
            chunkId: `${s.sceneId}_c1`,
            startMs: 0,
            endMs: measured[i % measured.length] as number,
          },
        ]),
      ]),
    );
    const placed = sequenceAlignments(ir.scenes, local);
    const solved = solveTiming(ir, placed, 0);

    for (const scene of solved.scenes) {
      const spoken = placed.get(scene.sceneId);
      if (!spoken) continue;
      const spokenMs =
        Math.max(...spoken.chunks.map((c) => c.endMs)) -
        Math.min(...spoken.chunks.map((c) => c.startMs));
      expect(scene.durationMs).toBeGreaterThanOrEqual(spokenMs);
    }
  });

  it("keeps the film contiguous while doing it", () => {
    const ir = must(parseFixture());
    for (const scene of ir.scenes) {
      scene.timing.startAnchor = { chunkId: `${scene.sceneId}_start`, offsetMs: 0 };
      scene.timing.endAnchor = { chunkId: `${scene.sceneId}_end`, offsetMs: 0 };
      scene.timing.elasticity = "elastic";
      scene.timing.minDurationMs = 0;
    }
    const local = new Map(
      ir.scenes.map((s, i) => [
        s.sceneId,
        withEndpoints(s.sceneId, [
          { chunkId: `${s.sceneId}_c1`, startMs: 0, endMs: 3000 + i * 900 },
        ]),
      ]),
    );
    const solved = solveTiming(ir, sequenceAlignments(ir.scenes, local), 0);
    // No gaps and no overlaps: each scene starts where the last one ended.
    for (let i = 1; i < solved.scenes.length; i++) {
      expect(must(solved.scenes[i]).startMs).toBe(must(solved.scenes[i - 1]).endMs);
    }
  });
});
