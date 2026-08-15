/* NARRATION PLAYBACK. Extracted from the deleted narration.js, re-keyed
 * from scenes to SPANS.
 *
 * The audio is a frozen input artifact: generated once at authoring time,
 * hashed, stored, named on the cut. Nothing here generates anything.
 *
 * WHY AN AudioContext AND NOT <audio> ELEMENTS. A span starts at a
 * millisecond the cut decided, and a dozen <audio> elements started by
 * setTimeout drift against each other and against the frames. The Web
 * Audio clock is sample-accurate and schedules ahead. Since the entire
 * premise is that the picture is cut to the speech, the two clocks being
 * the same clock is not a detail.
 *
 * Buffers are keyed by the asset's sha256, not by span id — the same span
 * re-narrated is a different artifact and must not hit a stale buffer.
 */

const VOICE = {
  ctx: null,
  /** sha256 → decoded AudioBuffer. */
  buffers: new Map(),
  playing: [],
};

function audioContext() {
  if (VOICE.ctx) return VOICE.ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  VOICE.ctx = new AC();
  return VOICE.ctx;
}

/** Fetch and decode every span. Idempotent — a buffer already decoded
 *  under its hash is reused, so opening the film twice costs one download.
 *  Bounded parallelism: strictly serial meant a film made one round trip
 *  per span before any sound could play; unbounded means every span hits
 *  the Worker at once, which is its own kind of slow. */
export async function loadVoice(cut, onProgress) {
  const ctx = audioContext();
  const spans = cut.voice?.spans ?? [];
  const failed = [];
  if (!ctx || spans.length === 0) return { loaded: 0, failed, total: spans.length };

  let loaded = 0;
  const queue = spans.slice();
  const lane = async () => {
    for (;;) {
      const span = queue.shift();
      if (!span) return;
      if (VOICE.buffers.has(span.sha256)) {
        loaded++;
        onProgress?.({ loaded, total: spans.length });
        continue;
      }
      try {
        const res = await fetch(span.url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        VOICE.buffers.set(span.sha256, await ctx.decodeAudioData(await res.arrayBuffer()));
        loaded++;
      } catch (err) {
        // Degrade, flag, continue. One span that will not decode must not
        // silence the film, and must not be invisible either.
        failed.push(`${span.spanId}: ${err.message}`);
      }
      onProgress?.({ loaded, total: spans.length });
    }
  };
  await Promise.all(Array.from({ length: Math.min(6, spans.length) }, lane));
  return { loaded, failed, total: spans.length };
}

/** Schedule onto a destination. `fromMs` is the playhead: spans already
 *  past are skipped and one mid-sentence starts partway in, so a seek
 *  lands where the picture landed rather than restarting the line. */
export function scheduleVoice(cut, destination, fromMs, whenSec) {
  const ctx = audioContext();
  if (!ctx) return [];
  const at = whenSec == null ? ctx.currentTime + 0.05 : whenSec;
  const started = [];

  /* NO TWO VOICES AT ONCE. Reported live on the old engine: narration
   * crowded on top of itself where a solved window was shorter than its
   * own recording. The cut no longer produces such a window — the
   * measured-duration floor sees to that — but an older cut, or one an
   * operator has shortened, would still put two people in the room. */
  let freeAtMs = 0;
  for (const span of cut.voice?.spans ?? []) {
    const buffer = VOICE.buffers.get(span.sha256);
    if (!buffer) continue;
    const beginMs = Math.max(span.startMs, freeAtMs);
    const endMs = beginMs + buffer.duration * 1000;
    freeAtMs = endMs;
    if (endMs <= fromMs) continue;

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(destination);
    src.start(at + Math.max(0, (beginMs - fromMs) / 1000), Math.max(0, (fromMs - beginMs) / 1000));
    started.push(src);
  }
  return started;
}

export async function playVoice(cut, fromMs) {
  const ctx = audioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") await ctx.resume();
  stopVoice();
  VOICE.playing = scheduleVoice(cut, ctx.destination, fromMs);
}

export function stopVoice() {
  for (const src of VOICE.playing) {
    try {
      src.stop();
    } catch {
      // Already finished; stopping a stopped source throws in some
      // browsers and means nothing.
    }
  }
  VOICE.playing = [];
}

/** An audio TRACK carrying the whole film, for the recorder. The browser
 *  muxes it alongside the canvas track — this system has no business
 *  owning a muxer, and the one time it tried it shipped corrupt files. */
export function voiceTrack(cut) {
  const ctx = audioContext();
  if (!ctx || !cut.voice) return null;
  const dest = ctx.createMediaStreamDestination();
  return {
    track: dest.stream.getAudioTracks()[0] || null,
    /** Called the instant recording starts, never before — a schedule laid
     *  down early runs ahead of frame zero and the film opens
     *  mid-sentence. */
    begin: () => scheduleVoice(cut, dest, 0, ctx.currentTime + 0.08),
    resume: () => (ctx.state === "suspended" ? ctx.resume() : Promise.resolve()),
  };
}

export { VOICE };
