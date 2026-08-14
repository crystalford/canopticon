/* CANOPTICON — narration playback.
 *
 * The audio itself is a frozen input artifact: generated once at authoring
 * time, hashed, stored, and named on the plan. This file never generates
 * anything. It fetches what the compiler already froze, decodes it once,
 * and schedules it — in the Preview so the operator can hear the film, and
 * into the render so the exported file has a voice.
 *
 * WHY AN AudioContext AND NOT <audio> ELEMENTS. A scene starts at a
 * millisecond the solver decided, and eighty-eight <audio> elements
 * started by setTimeout drift against each other and against the frames.
 * The Web Audio clock is sample-accurate and schedules ahead, so a scene
 * that begins at 41.283s begins at 41.283s. Since the whole point of
 * anchor-based timing is that the picture is cut to the speech, the two
 * clocks being the same clock is not a detail.
 *
 * NOTHING HERE IS CACHED ACROSS FILMS BY KEY ALONE. The buffers are keyed
 * by the asset's sha256, because that is the artifact's identity — the same
 * scene re-narrated is a different asset and must not hit a stale buffer.
 */

const NARRATION = {
  ctx: null,
  /** sha256 → decoded AudioBuffer. */
  buffers: new Map(),
  /** Live sources, so a seek can stop what is mid-sentence. */
  playing: [],
};

function audioContext() {
  if (!NARRATION.ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    NARRATION.ctx = new Ctor();
  }
  return NARRATION.ctx;
}

/** How many of this film's scenes have narration, and how many do not.
 *  Reported rather than inferred, because "this film is silent" and "this
 *  film is half narrated" are different states and the UI has to say
 *  which. */
function narrationStatus(plan) {
  const scenes = (plan && plan.scenes) || [];
  const withVo = scenes.filter((s) => s.vo && s.vo.url);
  const measured = withVo.filter((s) => s.vo.method && s.vo.method !== "unmeasured");
  return {
    total: scenes.length,
    narrated: withVo.length,
    measured: measured.length,
    silent: scenes.length - withVo.length,
    ms: withVo.reduce((a, s) => a + (s.vo.durationMs || 0), 0),
  };
}

/** Fetch and decode every scene's narration. Idempotent: a buffer already
 *  decoded under its hash is reused, so opening the Preview twice costs
 *  one download. */
async function loadNarration(plan, onProgress) {
  const ctx = audioContext();
  const scenes = ((plan && plan.scenes) || []).filter((s) => s.vo && s.vo.url);
  const failed = [];
  if (!ctx || scenes.length === 0) return { loaded: 0, failed, total: scenes.length };

  /* IN PARALLEL, BOUNDED. This was a strictly serial `for … await fetch`,
   * so a 65-scene film made 65 round trips end to end before the first
   * sound could play — which is most of the wait between pressing play and
   * hearing anything. Bounded rather than unbounded because 65 simultaneous
   * requests to one Worker is its own kind of slow. */
  let loaded = 0;
  const LANES = 6;
  const queue = scenes.slice();
  const lane = async () => {
    for (;;) {
      const scene = queue.shift();
      if (!scene) return;
      if (NARRATION.buffers.has(scene.vo.sha256)) {
        loaded++;
        if (onProgress) onProgress({ loaded, total: scenes.length });
        continue;
      }
      try {
        const res = await fetch(scene.vo.url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const bytes = await res.arrayBuffer();
        const buffer = await ctx.decodeAudioData(bytes);
        NARRATION.buffers.set(scene.vo.sha256, buffer);
        loaded++;
      } catch (err) {
        // Degrade, flag, continue. One scene that will not decode must not
        // silence the film, and it must not be invisible either.
        failed.push(`${scene.sceneId}: ${err.message}`);
      }
      if (onProgress) onProgress({ loaded, total: scenes.length });
    }
  };
  await Promise.all(Array.from({ length: Math.min(LANES, scenes.length) }, lane));
  return { loaded, failed, total: scenes.length };
}

/** Schedule the film's narration onto a destination node.
 *
 *  `fromMs` is where the playhead is; scenes already past are skipped and a
 *  scene mid-sentence starts partway in, which is what makes a seek land
 *  where the picture landed rather than restarting the line.
 *
 *  Returns the sources it started so the caller can stop them. */
function scheduleNarration(plan, destination, fromMs, whenSec) {
  const ctx = audioContext();
  if (!ctx) return [];
  const at = whenSec == null ? ctx.currentTime + 0.05 : whenSec;
  const started = [];

  for (const scene of (plan && plan.scenes) || []) {
    if (!scene.vo || !scene.vo.url) continue;
    const buffer = NARRATION.buffers.get(scene.vo.sha256);
    if (!buffer) continue;

    const endMs = scene.startMs + buffer.duration * 1000;
    if (endMs <= fromMs) continue;

    const offsetSec = Math.max(0, (fromMs - scene.startMs) / 1000);
    const startSec = at + Math.max(0, (scene.startMs - fromMs) / 1000);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(destination);
    src.start(startSec, offsetSec);
    started.push(src);
  }
  return started;
}

/** Play the film's narration from a playhead position, through the
 *  speakers. */
async function playNarration(plan, fromMs) {
  const ctx = audioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") await ctx.resume();
  stopNarration();
  NARRATION.playing = scheduleNarration(plan, ctx.destination, fromMs);
}

function stopNarration() {
  for (const src of NARRATION.playing) {
    try {
      src.stop();
    } catch {
      // Already finished. Stopping a stopped source throws in some
      // browsers and means nothing.
    }
  }
  NARRATION.playing = [];
}

/** An audio TRACK carrying the whole film's narration, for the recorder.
 *
 *  The render paces to the wall clock — the recorder writes on it — so the
 *  audio is scheduled once, at render start, against the same clock. The
 *  track is handed to MediaRecorder alongside the canvas track and the
 *  browser muxes them, which is the same division of labour the video side
 *  already settled on: this system has no business owning a muxer. */
function narrationTrack(plan) {
  const ctx = audioContext();
  if (!ctx) return null;
  const dest = ctx.createMediaStreamDestination();
  return {
    track: dest.stream.getAudioTracks()[0] || null,
    /** Called the instant recording starts, not before — a schedule laid
     *  down early would run ahead of frame zero. */
    begin: () => scheduleNarration(plan, dest, 0, ctx.currentTime + 0.08),
    resume: () => (ctx.state === "suspended" ? ctx.resume() : Promise.resolve()),
  };
}

Object.assign(window, {
  NARRATION,
  narrationStatus,
  loadNarration,
  playNarration,
  stopNarration,
  scheduleNarration,
  narrationTrack,
});
