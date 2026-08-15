/* THE EXPORT. Extracted whole from the deleted render.js, and
 * parameterised: it now takes a `draw(frameIndex)` callback instead of
 * knowing what a scene or a chain is.
 *
 * Everything hard about this file was learned the expensive way and is
 * preserved verbatim — the two-pass compute-then-replay, the measured
 * memory budget, the wall-clock pacing, and the honest result flags.
 *
 * THE ONE THING TO UNDERSTAND: audio is muxed by the browser, on the audio
 * clock, while frames are pushed on the wall clock. They agree only
 * because pass 2 replays pre-computed stills at real time. That is why a
 * 60-second film costs 60 seconds to export, and it is the price of having
 * a voice in the file at all.
 */

const REPLAY_BUDGET_BYTES = 640 * 1024 * 1024;

export const RENDER = { cancel: false };

function frameToBlob(canvas, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLCanvasElement} canvas
 * @param {{draw:(i:number)=>void, dispose?:()=>void, frames:number, fps:number,
 *          w:number, h:number, voice?:{track:MediaStreamTrack, begin:()=>any[]},
 *          onProgress?:(p:any)=>void}} cfg
 */
export async function encodeExact(ctx, canvas, cfg) {
  const onProgress = cfg.onProgress || (() => {});
  const mime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find(
    (m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m),
  );
  if (!mime) throw new Error("this browser cannot record a canvas");

  /* ── PASS 1 · COMPUTE ───────────────────────────────────────────────
   * Nothing is recording yet, so a frame may take as long as it needs.
   * The budget is MEASURED from frame zero rather than assumed: a flat
   * graphic frame and a dense field differ by an order of magnitude in
   * JPEG size, and a constant would either waste memory or refuse films
   * that would have fitted. */
  let stills = null;
  let quality = 0.9;
  let durationExact = true;
  let sized = 0;

  cfg.draw(0);
  let probe = await frameToBlob(canvas, quality);
  if (probe && probe.size * cfg.frames > REPLAY_BUDGET_BYTES) {
    quality = 0.62;
    probe = await frameToBlob(canvas, quality);
  }
  if (!probe || probe.size * cfg.frames > REPLAY_BUDGET_BYTES) {
    // TOO BIG TO HOLD. Degrade, flag, continue: the film still renders,
    // and the result SAYS the duration is wrong rather than pretending.
    durationExact = false;
  } else {
    stills = new Array(cfg.frames);
    stills[0] = probe;
    sized = probe.size;
    for (let frame = 1; frame < cfg.frames; frame++) {
      if (RENDER.cancel) break;
      cfg.draw(frame);
      const b = await frameToBlob(canvas, quality);
      stills[frame] = b;
      sized += b ? b.size : 0;
      if (frame % 4 === 0) {
        onProgress({ stage: "computing", frame, frames: cfg.frames, pct: frame / cfg.frames });
      }
    }
    if (RENDER.cancel) stills = null;
  }

  // Zero fps: the stream produces a frame only when we hand it one.
  const stream = canvas.captureStream(0);
  const track = stream.getVideoTracks()[0];
  if (cfg.voice?.track) stream.addTrack(cfg.voice.track);

  const chunks = [];
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 9_000_000 });
  rec.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  const finished = new Promise((resolve) => {
    rec.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
  });
  rec.start(400);
  // Started AFTER the recorder, never before: a schedule laid down first
  // would have the first line half-spoken by the time frame zero is
  // written, and the film would open mid-sentence.
  const voices = cfg.voice ? cfg.voice.begin() : [];
  const started = performance.now();
  const frameMs = 1000 / cfg.fps;
  let late = 0;
  let dropped = 0;

  for (let frame = 0; frame < cfg.frames; frame++) {
    if (RENDER.cancel) break;
    if (stills) {
      const bmp = await createImageBitmap(stills[frame]);
      ctx.drawImage(bmp, 0, 0, cfg.w, cfg.h);
      bmp.close();
    } else {
      cfg.draw(frame);
    }
    if (track.requestFrame) track.requestFrame();
    else dropped++;

    const due = started + frame * frameMs;
    const wait = due - performance.now();
    if (wait < -frameMs * 2) late++;
    await new Promise((r) => setTimeout(r, Math.max(0, wait)));

    if (frame % 4 === 0) {
      onProgress({
        stage: stills ? "writing" : "rendering",
        frame,
        frames: cfg.frames,
        pct: frame / cfg.frames,
      });
    }
  }

  onProgress({ stage: "finishing", frame: cfg.frames, frames: cfg.frames, pct: 1 });
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
  cfg.dispose?.();
  stills = null;

  return {
    blob,
    frameExact: dropped === 0,
    /** Whether the FILE'S clock is the film's clock. False only on the
     *  fallback path, where the export reverts to the wall clock — the
     *  caller must say so rather than hand over a file that is silently
     *  nine times too long. */
    durationExact,
    late,
    heldBytes: sized,
    frames: cfg.frames,
    narrated: voices.length,
    /** CANCELLED IS NOT DONE. The old loop broke on cancel and then
     *  reported `frames` regardless, producing a success screen and a
     *  Download button for a file holding forty frames. */
    cancelled: Boolean(RENDER.cancel),
  };
}
