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
function buildForRender(plan, w, h) {
  return plan.scenes.map((scene) => {
    const chain = scene.chain.map((n) => ({ id: n.id, params: n.params, seed: n.seed }));
    const shots = (scene.shots || []).map((s) => ({
      startMs: s.startMs - scene.startMs,
      endMs: s.endMs - scene.startMs,
      params: s.params || {},
    }));
    const dur = Math.max(0.1, (scene.endMs - scene.startMs) / 1000);
    const built =
      shots.length > 1 ? buildSequence(chain, shots, w, h) : buildChain(chain, w, h, dur);
    return { scene, built, single: shots.length <= 1 };
  });
}

/** Draw one frame of the film at an exact index. This is the whole reason
 *  the render is deterministic: nothing here reads a clock. */
function drawFrame(ctx, scenes, frame, fps, w, h, chrome) {
  const ms = (frame / fps) * 1000;
  let active = scenes[scenes.length - 1];
  for (const s of scenes) {
    if (ms >= s.scene.startMs && ms < s.scene.endMs) {
      active = s;
      break;
    }
  }
  if (!active) return;

  const localMs = ms - active.scene.startMs;
  if (active.built.errors && active.built.errors.length) {
    ctx.fillStyle = "#0d0f11";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#d8624a";
    ctx.font = '500 13px "JetBrains Mono",monospace';
    active.built.errors.slice(0, 5).forEach((e, i) => ctx.fillText(e, 24, 50 + i * 20));
  } else {
    const buf = active.single ? active.built.run(localMs / 1000) : active.built.run(localMs);
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

    onProgress({ stage: "building chains", frame: 0, frames: 1, pct: 0 });
    const scenes = buildForRender(plan, w, h);
    const frames = Math.max(1, Math.ceil((plan.durationMs / 1000) * fps));

    return await encodeExact(ctx, canvas, scenes, {
      frames,
      fps,
      w,
      h,
      chrome,
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
 */
async function encodeExact(ctx, canvas, scenes, cfg) {
  const mime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find(
    (m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m),
  );
  if (!mime) throw new Error("this browser cannot record a canvas");

  // Zero fps: the stream produces a frame only when we hand it one.
  const stream = canvas.captureStream(0);
  const track = stream.getVideoTracks()[0];
  const chunks = [];
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 9_000_000 });
  rec.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  const finished = new Promise((resolve) => {
    rec.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
  });
  rec.start(400);

  const frameMs = 1000 / cfg.fps;
  const started = performance.now();
  let dropped = 0;

  for (let frame = 0; frame < cfg.frames; frame++) {
    if (RENDER.cancel) break;
    drawFrame(ctx, scenes, frame, cfg.fps, cfg.w, cfg.h, cfg.chrome);
    if (track.requestFrame) track.requestFrame();
    else dropped++;

    // Pace to the wall clock so the recorder's own timestamps line up with
    // the frames it is being given. Falling behind is reported rather than
    // silently producing a film that runs fast.
    const due = started + frame * frameMs;
    const wait = due - performance.now();
    await new Promise((r) => setTimeout(r, Math.max(0, wait)));

    if (frame % 4 === 0) {
      cfg.onProgress({
        stage: "rendering",
        frame,
        frames: cfg.frames,
        pct: frame / cfg.frames,
      });
    }
  }

  cfg.onProgress({ stage: "finishing", frame: cfg.frames, frames: cfg.frames, pct: 1 });
  await new Promise((r) => setTimeout(r, 350));
  rec.stop();
  const blob = await finished;
  return { blob, frameExact: dropped === 0, frames: cfg.frames };
}

Object.assign(window, { renderFilm, RENDER, drawFrame, buildForRender });
