/* CANOPTICON — RENDER. A step, not a side effect.
 *
 * The film used to be produced by pressing EXPORT and watching the Preview
 * play at wall-clock speed while a recorder listened. Three things were
 * wrong with that and all three were the same thing:
 *
 *   IT TOOK AS LONG AS THE FILM. A six-minute essay cost six minutes.
 *
 *   IT WAS NOT DETERMINISTIC. Frames were captured on the browser's clock,
 *   so a slow frame was a dropped frame and two renders of one plan were
 *   not the same file. The system's own determinism claim — L2 within a
 *   pinned environment — was not actually being made good on at the one
 *   moment it mattered.
 *
 *   THERE WAS NO RENDER. Adjusting a knob and watching it re-draw live is
 *   how a toy behaves. A film is something you SET UP and then RENDER, and
 *   the difference is not cosmetic: it is what lets a frame take as long as
 *   it needs, which is what lets a chain be rich.
 *
 * So this drives the chain BY FRAME INDEX. Frame 900 of a 30fps film is
 * t = 30.0s exactly, whatever the machine was doing at the time, and the
 * frame is handed to the recorder explicitly rather than scraped off a
 * live canvas — so a frame that takes 200ms to compute is still one frame
 * of film rather than six missing ones.
 *
 * It is NOT faster than real time. The recorder writes on the wall clock,
 * so six minutes of film still costs about six minutes. Said plainly here
 * and in the panel, because knowing what a render costs before starting it
 * is most of the reason to have a render step at all.
 *
 * Progress is reported per frame — a render with no progress bar is
 * indistinguishable from a hang, which is exactly what it looked like.
 */

const RENDER = {
  running: false,
  cancel: false,
};

/** Build every scene's chain once, at render resolution. Instances hold
 *  state — particle positions, motion history — so they are created once
 *  and driven by index, never rebuilt mid-film. */
/* THE WHOLE FILM'S CANVASES, ALL AT ONCE — the same leak as the Preview,
 * in a worse form.
 *
 * This built EVERY scene's chain before a single frame was encoded, and
 * released none of them. At 1280×720 a chain is tens of megabytes, a
 * scene-graph scene nests one chain per element, and a multi-shot scene
 * builds one per shot — so a thirty-nine scene film allocated the entire
 * film's frame buffers up front and could exhaust memory before the
 * encoder had drawn frame zero.
 *
 * Frames are computed in ORDER, so at most one scene is ever being drawn.
 * Building on demand and releasing what the playhead has passed makes the
 * export's memory a property of the SCENE rather than of the film, which
 * is what lets a long film export at all. */
function buildForRender(plan, w, h) {
  return plan.scenes.map((scene) => {
    const chain = scene.chain.map((n) => ({
      id: n.id,
      params: n.params,
      seed: n.seed,
      // A compositor's ground. Dropping it here would export a film whose
      // second layer is missing while the Preview showed it — the two
      // surfaces disagreeing about one plan is exactly the failure that
      // made the Lab stop having a second engine.
      ...(n.b ? { b: n.b } : {}),
      // The bridge, exported exactly as it is previewed. The Preview and
      // the export reading one plan differently is the failure that made
      // the Lab stop having a second engine.
      ...(n.tween && n.tweenMs
        ? { tween: n.tween, tweenMs: n.tweenMs, ...(n.tweenAtMs ? { tweenAtMs: n.tweenAtMs } : {}) }
        : {}),
    }));
    const shots = (scene.shots || []).map((s) => ({
      startMs: s.startMs - scene.startMs,
      endMs: s.endMs - scene.startMs,
      params: s.params || {},
    }));
    const dur = Math.max(0.1, (scene.endMs - scene.startMs) / 1000);
    return { scene, chain, shots, dur, w, h, built: null, single: shots.length <= 1 };
  });
}

/** Build one scene's chain, and release every other one. Deterministic
 *  either way: a chain is a pure function of its plan, its seeds and the
 *  frame index, so rebuilding one produces the identical film. */
function realiseScene(entry, scenes) {
  if (!entry.built) {
    entry.built =
      entry.shots.length > 1
        ? buildSequence(entry.chain, entry.shots, entry.w, entry.h)
        : buildChain(entry.chain, entry.w, entry.h, entry.dur);
  }
  for (const other of scenes) {
    if (other === entry || !other.built) continue;
    other.built.dispose?.();
    other.built = null;
  }
  return entry.built;
}

/** Release everything, for the end of a render or an abandoned one. */
function releaseScenes(scenes) {
  for (const s of scenes) {
    s.built?.dispose?.();
    s.built = null;
  }
}

/** Draw one frame of the film at an exact index. This is the whole reason
 *  the render is deterministic: nothing here reads a clock. */
function drawFrame(ctx, scenes, frame, fps, w, h, chrome) {
  applyFilmPalette();
  const ms = (frame / fps) * 1000;
  let active = scenes[scenes.length - 1];
  for (const s of scenes) {
    if (ms >= s.scene.startMs && ms < s.scene.endMs) {
      active = s;
      break;
    }
  }
  if (!active) return;

  // Built here rather than up front, and everything else released — see
  // `buildForRender`. Frames are computed in order, so exactly one scene's
  // buffers are alive at any moment.
  const built = realiseScene(active, scenes);

  const localMs = ms - active.scene.startMs;
  if (built.errors && built.errors.length) {
    ctx.fillStyle = "#0d0f11";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#d8624a";
    ctx.font = '500 13px "JetBrains Mono",monospace';
    built.errors.slice(0, 5).forEach((e, i) => ctx.fillText(e, 24, 50 + i * 20));
  } else {
    const buf = active.single ? built.run(localMs / 1000) : built.run(localMs);
    // CLEAR FIRST. A chain's last stage can hand back a buffer with
    // transparency in it — field_erode does, by design — and drawing that
    // over an uncleared canvas leaves the PREVIOUS FRAME showing through
    // the holes. The film smears, and it smears in a way that looks like a
    // deliberate effect until you step through it.
    ctx.fillStyle = "#0d0f11";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(buf, 0, 0, w, h);
  }

  if (chrome) burnCaption(ctx, active.scene.text, w, h);
}

/** The sentence, burned into the frame. Optional, because a film destined
 *  for narration should not carry its own subtitles — but until narration
 *  exists the prose is the only thing telling a viewer what they are
 *  looking at, so it defaults on. */
function burnCaption(ctx, text, w, h) {
  const pad = Math.round(w * 0.045);
  const size = Math.max(13, Math.round(w * 0.019));
  const g = ctx.createLinearGradient(0, h - size * 7, 0, h);
  g.addColorStop(0, "rgba(8,9,10,0)");
  g.addColorStop(1, "rgba(8,9,10,.93)");
  ctx.fillStyle = g;
  ctx.fillRect(0, h - size * 7, w, size * 7);

  ctx.font = `400 ${size}px "Space Grotesk", sans-serif`;
  ctx.fillStyle = "#eef1f3";
  ctx.textBaseline = "alphabetic";
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > w - pad * 2 && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  const show = lines.slice(0, 3);
  show.forEach((l, i) => {
    ctx.fillText(l, pad, h - pad - (show.length - 1 - i) * size * 1.45);
  });
}

/** Render the whole film to a file.
 *
 *  `onProgress({frame, frames, pct, stage})` is called throughout — the
 *  point of a render step is that you can watch it happen. */
async function renderFilm(plan, options) {
  const opts = options || {};
  const w = opts.width || 1280;
  const h = opts.height || 720;
  const fps = opts.fps || 30;
  const chrome = opts.captions !== false;
  const onProgress = opts.onProgress || (() => {});

  if (RENDER.running) throw new Error("a render is already running");
  RENDER.running = true;
  RENDER.cancel = false;

  try {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");

    // The narration, if the film has any. Decoded BEFORE the recorder
    // starts: fetching eighty audio files while frames are being written
    // would stall the wall clock the recorder is pacing against, and a
    // stalled render is a stretched film.
    let voice = null;
    if (opts.narration !== false && narrationStatus(plan).narrated > 0) {
      onProgress({ stage: "loading narration", frame: 0, frames: 1, pct: 0 });
      const got = await loadNarration(plan, (p) =>
        onProgress({
          stage: `loading narration ${p.loaded}/${p.total}`,
          frame: 0,
          frames: 1,
          pct: 0,
        }),
      );
      if (got.loaded > 0) {
        voice = narrationTrack(plan);
        await voice.resume();
      }
      if (got.failed.length) console.warn("narration", got.failed);
    }

    onProgress({ stage: "building chains", frame: 0, frames: 1, pct: 0 });
    const scenes = buildForRender(plan, w, h);
    const frames = Math.max(1, Math.ceil((plan.durationMs / 1000) * fps));

    return await encodeExact(ctx, canvas, scenes, {
      frames,
      fps,
      w,
      h,
      chrome,
      voice,
      onProgress,
    });
  } finally {
    RENDER.running = false;
  }
}

/** FRAME-EXACT CONTENT, BROWSER-WRITTEN CONTAINER.
 *
 * The first attempt at this encoded through WebCodecs and muxed the WebM by
 * hand. The frames were exact and the file did not decode — because a
 * container is a real format and a hand-rolled EBML writer with one wrong
 * VINT is a corrupt file that looks like a working one. This system has no
 * business owning a muxer.
 *
 * So: every frame is still drawn at its exact index — nothing here reads a
 * clock to decide what to draw — and the frames are pushed into a capture
 * stream one at a time with `requestFrame()`, which is precisely what that
 * API is for. The browser writes the container.
 *
 * What this buys and what it does not:
 *
 *   NO DROPPED FRAMES. `captureStream(0)` captures only when asked, so a
 *   frame that takes 200ms to compute is still exactly one frame of film
 *   rather than six missing ones. That is the failure the old real-time
 *   export had and could not report.
 *
 *   STILL NOT FASTER THAN REAL TIME. The recorder writes on the wall clock,
 *   so a six-minute film still takes about six minutes — longer, if the
 *   chains are expensive. Stated here rather than implied, because the
 *   whole point of a render step is knowing what it costs before starting.
 *
 * ── AND THE PART THAT WAS STILL WRONG ────────────────────────────────
 *
 * An 8.36s film wrote a 73s file. Measured twice. The frames were correct
 * and in order; the FILE'S CLOCK was not, and the reason is not a bug to
 * patch — MediaRecorder timestamps a frame when it ARRIVES, by design. The
 * loop below paced to the wall clock, but the chains cannot compute 30fps,
 * so `wait` was always negative, frames arrived as fast as they could be
 * drawn, and the file's duration became the time the RENDER took. The
 * primary artifact of the whole product ran at about a ninth speed.
 *
 * So the work is split in two, and neither half needs a container of our
 * own — which matters, because the first attempt at this DID own one and
 * shipped corrupt files:
 *
 *   PASS 1 · COMPUTE. Every frame drawn at its exact index and kept as a
 *   JPEG. No recorder running, no clock consulted, takes as long as it
 *   takes.
 *
 *   PASS 2 · REPLAY. The stored frames pushed into the recorder paced to
 *   the real clock. Decoding and blitting a finished image is 1–3ms
 *   against a 33ms budget, so arrival time IS correct time and the file's
 *   duration is the film's duration.
 *
 * Sound is why this is the right shape rather than a clever one: the voice
 * plays on the audio clock, so picture only agrees with it if picture runs
 * at true speed. Pass 2 does.
 *
 * The cost is memory, and it is BOUNDED BY MEASUREMENT rather than by a
 * guessed constant — frame zero is encoded, its real size read, and the
 * whole film extrapolated from it. Over budget, quality drops once; still
 * over, it says so and falls back to the single pass rather than dying,
 * carrying `durationExact: false` so the surface can tell the truth about
 * the file it just produced.
 */

/** The frame currently on the canvas, as a JPEG blob. */
function frameToBlob(canvas, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

/** How much memory the whole film would take at this quality, measured
 *  from one real frame rather than assumed from pixel count. */
const REPLAY_BUDGET_BYTES = 640 * 1024 * 1024;

async function encodeExact(ctx, canvas, scenes, cfg) {
  const mime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find(
    (m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m),
  );
  if (!mime) throw new Error("this browser cannot record a canvas");

  /* ── PASS 1 · COMPUTE ───────────────────────────────────────────────
   *
   * Nothing is recording yet, so a frame may take as long as it needs.
   * The budget is measured from frame zero rather than assumed: a flat
   * graphic frame and a dense particle field differ by an order of
   * magnitude in JPEG size, and guessing a constant would either waste
   * memory or refuse films that would have fitted. */
  let stills = null;
  let quality = 0.9;
  let durationExact = true;
  let sized = 0;

  {
    drawFrame(ctx, scenes, 0, cfg.fps, cfg.w, cfg.h, cfg.chrome);
    let probe = await frameToBlob(canvas, quality);
    if (probe && probe.size * cfg.frames > REPLAY_BUDGET_BYTES) {
      quality = 0.62;
      probe = await frameToBlob(canvas, quality);
    }
    if (!probe || probe.size * cfg.frames > REPLAY_BUDGET_BYTES) {
      // TOO BIG TO HOLD. Degrade, flag, continue: the film still renders,
      // and the result says the duration is wrong rather than pretending.
      durationExact = false;
    } else {
      stills = new Array(cfg.frames);
      stills[0] = probe;
      sized = probe.size;
      for (let frame = 1; frame < cfg.frames; frame++) {
        if (RENDER.cancel) break;
        drawFrame(ctx, scenes, frame, cfg.fps, cfg.w, cfg.h, cfg.chrome);
        const b = await frameToBlob(canvas, quality);
        stills[frame] = b;
        sized += b ? b.size : 0;
        if (frame % 4 === 0) {
          cfg.onProgress({
            stage: "computing",
            frame,
            frames: cfg.frames,
            pct: frame / cfg.frames,
          });
        }
      }
      if (RENDER.cancel) stills = null;
    }
  }

  // Zero fps: the stream produces a frame only when we hand it one.
  const stream = canvas.captureStream(0);
  const track = stream.getVideoTracks()[0];
  // The voice, on the same stream, so the browser muxes one file. Audio is
  // NOT frame-driven — it plays on the audio clock while frames are pushed
  // on the wall clock — and those two agree only because the loop below
  // paces to real time. That is the honest reason this export is not
  // faster than the film: sound.
  if (cfg.voice && cfg.voice.track) stream.addTrack(cfg.voice.track);
  const chunks = [];
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 9_000_000 });
  rec.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  const finished = new Promise((resolve) => {
    rec.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
  });
  rec.start(400);
  // Started AFTER the recorder, not before: a schedule laid down first
  // would have the first line half-spoken by the time frame zero is
  // written, and the film would open mid-sentence.
  const voices = cfg.voice ? cfg.voice.begin() : [];
  const started = performance.now();
  let late = 0;

  const frameMs = 1000 / cfg.fps;
  let dropped = 0;

  for (let frame = 0; frame < cfg.frames; frame++) {
    if (RENDER.cancel) break;
    // Pre-computed in pass 1 when the film fits in memory; drawn here only
    // on the fallback path, where the file's duration will be wrong and
    // says so.
    if (stills) {
      const bmp = await createImageBitmap(stills[frame]);
      ctx.drawImage(bmp, 0, 0, cfg.w, cfg.h);
      bmp.close();
    } else {
      drawFrame(ctx, scenes, frame, cfg.fps, cfg.w, cfg.h, cfg.chrome);
    }
    if (track.requestFrame) track.requestFrame();
    else dropped++;

    // Pace to the wall clock so the recorder's own timestamps line up with
    // the frames it is being given. With pass 1 done this is a real wait
    // rather than a permanently-negative one, which is the entire
    // difference between an 8s film and a 73s file.
    const due = started + frame * frameMs;
    const wait = due - performance.now();
    if (wait < -frameMs * 2) late++;
    await new Promise((r) => setTimeout(r, Math.max(0, wait)));

    if (frame % 4 === 0) {
      cfg.onProgress({
        stage: stills ? "writing" : "rendering",
        frame,
        frames: cfg.frames,
        pct: frame / cfg.frames,
      });
    }
  }

  cfg.onProgress({ stage: "finishing", frame: cfg.frames, frames: cfg.frames, pct: 1 });
  await new Promise((r) => setTimeout(r, 350));
  for (const src of voices) {
    try {
      src.stop();
    } catch {
      // Already finished on its own.
    }
  }
  rec.stop();
  const blob = await finished;
  // The buffers are the film's, not the page's — hand them back before the
  // caller does anything else with this tab.
  releaseScenes(scenes);
  stills = null;
  return {
    blob,
    frameExact: dropped === 0,
    /** Whether the FILE'S CLOCK is the film's clock. False only on the
     *  fallback path, where the film was too large to hold and the export
     *  reverts to writing on the wall clock — the caller must say so
     *  rather than hand over a file that is silently nine times too long. */
    durationExact,
    /** Frames that still arrived late during replay. Zero on any healthy
     *  render; non-zero means the duration is approximate even here. */
    late,
    heldBytes: sized,
    frames: cfg.frames,
    narrated: voices.length,
  };
}

Object.assign(window, { renderFilm, RENDER, drawFrame, buildForRender });
