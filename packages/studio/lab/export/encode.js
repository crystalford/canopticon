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

/* ── THE DURATION MediaRecorder DOES NOT WRITE ────────────────────────
 *
 * A file MediaRecorder produced plays, but reports no length: no seek bar,
 * no scrubbing, in some players no total time at all. The reason is
 * structural, not a bug in this code — MediaRecorder streams, so its
 * Segment is written with an UNKNOWN size and its Info block carries no
 * Duration, because when the header goes out the recording has not
 * finished yet. Every export this instrument has ever produced has this
 * gap, silently, because Chrome plays the file regardless and nothing here
 * ever looked.
 *
 * Splicing one EBML element into Info fixes it, and is safe here for a
 * checked reason: this file has no SeekHead and no Cues, so nothing in it
 * holds an absolute byte offset that inserting eleven bytes would
 * invalidate, and the Segment's own size is already UNKNOWN so it needs no
 * rewriting either. Both facts are checked, not assumed — if either stops
 * being true the patch declines and the original file is returned exactly
 * as MediaRecorder wrote it, playable but unscrubbable, same as before.
 */
function readVint(b, at) {
  const m = b[at];
  let len = 1;
  for (let i = 7; i >= 0; i--) {
    if (m & (1 << i)) {
      len = 8 - i;
      break;
    }
  }
  return { len, first: m };
}
function readId(b, at) {
  const { len } = readVint(b, at);
  let v = 0;
  for (let i = 0; i < len; i++) v = v * 256 + b[at + i];
  return { v, len };
}
function readSize(b, at) {
  const { len, first } = readVint(b, at);
  let v = first & ((1 << (8 - len)) - 1);
  let unknown = v === (1 << (8 - len)) - 1;
  for (let i = 1; i < len; i++) {
    v = v * 256 + b[at + i];
    if (b[at + i] !== 0xff) unknown = false;
  }
  return { v, len, unknown };
}
function writeSize(n) {
  for (let len = 1; len <= 8; len++) {
    if (n < 2 ** (7 * len) - 1) {
      const out = new Uint8Array(len);
      let v = n;
      for (let i = len - 1; i >= 0; i--) {
        out[i] = v & 0xff;
        v = Math.floor(v / 256);
      }
      out[0] |= 1 << (8 - len);
      return out;
    }
  }
  throw new Error("size too large");
}

/** Returns a new Blob with a Duration element spliced into its Info block,
 *  or the original blob unchanged if the file's shape doesn't match what
 *  this patch was checked safe for. */
async function withDuration(blob, ms) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let at = 0;
  const head = readId(buf, at);
  if (head.v !== 0x1a45dfa3) return blob; // no EBML header
  const headSize = readSize(buf, at + head.len);
  at += head.len + headSize.len + headSize.v;
  const seg = readId(buf, at);
  if (seg.v !== 0x18538067) return blob; // no Segment
  const segSize = readSize(buf, at + seg.len);
  if (!segSize.unknown) return blob; // has a known size — not this shape

  let p = at + seg.len + segSize.len;
  while (p < buf.length) {
    const cid = readId(buf, p);
    const csz = readSize(buf, p + cid.len);
    if (cid.v === 0x114d9b74) return blob; // SeekHead present — not patching
    if (cid.v === 0x1c53bb6b) return blob; // Cues present — not patching
    if (cid.v === 0x1549a966) {
      const start = p + cid.len + csz.len;
      let scale = 1_000_000;
      for (let q = start; q < start + csz.v; ) {
        const gi = readId(buf, q);
        const gs = readSize(buf, q + gi.len);
        if (gi.v === 0x4489) return blob; // already has a Duration
        if (gi.v === 0x2ad7b1) {
          scale = 0;
          for (let k = 0; k < gs.v; k++) scale = scale * 256 + buf[q + gi.len + gs.len + k];
        }
        q += gi.len + gs.len + gs.v;
      }
      const dur = new Uint8Array(11);
      const dv = new DataView(dur.buffer);
      dv.setUint16(0, 0x4489);
      dur[2] = 0x88; // an 8-byte payload
      dv.setFloat64(3, (ms * 1e6) / scale, false);
      const sizeBytes = writeSize(csz.v + dur.length);
      const grown = new Uint8Array(buf.length + dur.length + (sizeBytes.length - csz.len));
      let w = 0;
      grown.set(buf.subarray(0, p + cid.len), w);
      w += p + cid.len;
      grown.set(sizeBytes, w);
      w += sizeBytes.length;
      grown.set(buf.subarray(p + cid.len + csz.len, start), w);
      w += start - (p + cid.len + csz.len);
      grown.set(dur, w);
      w += dur.length;
      grown.set(buf.subarray(start), w);
      return new Blob([grown], { type: blob.type });
    }
    if (cid.v === 0x1f43b675) return blob; // a Cluster means Info never appeared
    p += cid.len + csz.len + csz.v;
  }
  return blob;
}

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
  const rawBlob = await finished;
  cfg.dispose?.();
  stills = null;

  // Patched to the FRAME-EXACT duration, not the wall-clock elapsed —
  // that is the whole point of pass 2 replaying stills at the paced
  // interval rather than trusting the recording to land on time.
  const blob = durationExact
    ? await withDuration(rawBlob, (cfg.frames / cfg.fps) * 1000)
    : rawBlob;

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
