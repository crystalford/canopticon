/* THE FILM. Watch it, re-roll it, export it.
 *
 * The preview plays on the Web Audio clock so the picture and the voice
 * are on ONE clock; the export replays pre-computed frames at real time
 * for the same reason. Both are honest about what they are.
 */

import { buildStages } from "../comp/compose.js";
import { encodeExact, RENDER } from "../export/encode.js";
import { loadVoice, playVoice, stopVoice, voiceTrack } from "../export/voice.js";
import { drawFrame, prepareFilm } from "../paint/frame.js";
import { renderTypeLayer } from "../threejs/composition.js";
import { initThreeJSRenderer } from "../threejs/render.js";
import { api } from "./api.js";

export async function viewFilm(root, go, id) {
  root.innerHTML = `
    <div class="phead">
      <h1 id="title">…</h1>
      <p class="sub" id="sub"></p>
    </div>
    <canvas id="stage" width="1280" height="720"></canvas>
    <div class="progress"><i id="played"></i></div>
    <div class="actions">
      <button id="play">Play</button>
      <button class="ghost" id="reroll">Reseed</button>
      <button class="ghost" id="export">Export</button>
      <button class="ghost" id="back">New film</button>
      <span class="note" id="status"></span>
    </div>
    <div class="actions">
      <select id="voice"><option value="">Voice…</option></select>
      <button class="ghost" id="record">Record the narration</button>
      <span class="note" id="vostatus"></span>
    </div>
    <div id="warnings"></div>`;

  const $ = (s) => root.querySelector(`#${s}`);
  const canvas = $("stage");
  const ctx = canvas.getContext("2d");
  $("back").addEventListener("click", () => go(""));

  let film = null;
  let cut = null;
  let raf = 0;
  let startedAt = 0;
  /** THE PLAYHEAD. The one piece of state the old player never had — it
   *  knew only "playing since startedAt" or "stopped", so Play always
   *  restarted at zero and a click on the bar could paint a still but
   *  never actually MOVE the film. Every play/pause/seek path below reads
   *  and writes this, in film milliseconds. */
  let positionMs = 0;
  let renderer = null; // Three.js renderer instance, or null for Canvas 2D legacy
  let threeStages = null; // Editorial stages for the Three.js type layer (Layer 4)

  /** A film the previous engine made. Its essay survives; nothing else in
   *  it means anything now. Offer the re-read rather than a dead end — and
   *  make it a button, because a page load must not spend a model call.
   *
   *  ONE BUTTON, NOT TWO. The standalone "Record the narration" button
   *  below operates on spans that only exist once the essay has been
   *  re-read into the new engine's IR — on a legacy film there is no span
   *  yet, so it has nothing to do here and is hidden. Re-reading and
   *  recording are folded into one action instead: the operator picks a
   *  voice (or leaves the film silent) and clicks once. */
  function offerReread(info) {
    $("title").textContent = info.title || "A film from the previous engine";
    $("sub").textContent = `${info.words} words · made before the engine was rebuilt`;
    canvas.style.display = "none";
    $("play").style.display = "none";
    $("reroll").style.display = "none";
    $("export").style.display = "none";
    $("record").style.display = "none";
    const btn = document.createElement("button");
    btn.textContent = "Re-read & record the narration";
    $("play").parentElement.prepend(btn);
    $("warnings").innerHTML =
      `<p class="warn">the essay is kept and re-read; the old version stays in the film's history</p>
       <p class="warn">the previous recordings cannot carry over — this reads it and records it fresh</p>`;
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      $("status").textContent = "reading the essay…";
      try {
        await api.reread(id);
        const voice = $("voice").value;
        if (voice) {
          $("status").textContent = "recording narration…";
          await api.narrateAndWait(id, voice, (p) => {
            $("status").textContent =
              p.state === "done"
                ? "measuring…"
                : `speaking ${p.spoken ?? 0}/${p.spans ?? "?"} spans…`;
          });
        }
        location.reload();
      } catch (err) {
        $("status").textContent = err.message;
        btn.disabled = false;
      }
    });
  }

  async function load() {
    let meta;
    try {
      meta = await api.film(id);
    } catch (err) {
      if (err.legacy) return offerReread(err.body);
      throw err;
    }
    $("title").textContent = meta.film.title;
    cut = await api.cut(id);

    // Dispose of previous renderer if exists
    if (renderer?.dispose) renderer.dispose();
    renderer = null;
    film = null;
    threeStages = null;

    // The faces are the material for BOTH backends — Layer 4's type layer
    // draws real editorial text same as the legacy renderer does. Drawing
    // before they load renders a system fallback and everything judged is
    // the wrong typeface.
    await document.fonts.ready;

    if (cut.renderBackend === "threejs-procedural") {
      renderer = initThreeJSRenderer(canvas, cut);
      threeStages = buildStages(cut).stages;
      $("sub").textContent =
        `${cut.beats.length} beats · ${(cut.durationMs / 1000).toFixed(1)}s · seed ${cut.seed} · Three.js · ${meta.editorial}`;
    } else {
      film = prepareFilm(cut, buildStages(cut));
      $("sub").textContent =
        `${cut.beats.length} beats · ${(cut.durationMs / 1000).toFixed(1)}s · seed ${cut.seed} · Canvas 2D · ${meta.editorial}`;
    }

    $("warnings").innerHTML = (cut.warnings ?? [])
      .map((w) => `<p class="warn">${escape(w)}</p>`)
      .join("");
    if (cut.voice) await loadVoice(cut).catch(() => undefined);

    renderAt(0);

    describeVoice(meta.film);
  }

  /** Layer 1+2 (WebGL ground) composited onto the visible 2D canvas, then
   *  Layer 4 (editorial type) drawn on top of it — same stages, same
   *  timeline, same behaviors as the legacy renderer. `ms` is absolute
   *  film time, matching what `resolveAt` expects. */
  function renderThreeJSFrame(ms) {
    const beatIndex = Math.max(
      0,
      cut.beats.findIndex((b) => b.startMs <= ms && ms < b.endMs),
    );
    const timeInBeat = ms - (cut.beats[beatIndex]?.startMs ?? 0);
    const pixelData = renderer.renderFrame(beatIndex, timeInBeat);
    if (pixelData) {
      const imageData = new ImageData(pixelData, canvas.width, canvas.height);
      ctx.putImageData(imageData, 0, 0);
    }
    if (threeStages) renderTypeLayer(ctx, canvas.width, canvas.height, threeStages, ms);
  }

  /* ── narration, on a film that already exists ─────────────────────
   *
   * There was no way to record a film you already had open. Narration
   * could only be asked for at creation, so a film whose recording failed,
   * or whose prose was edited afterwards, or that was made silent and
   * wanted a voice, had no route back except making it again. The cut
   * itself already REPORTS a stale span — "the writing changed after it
   * was recorded" — which made the absence worse: the system told the
   * operator about a problem it gave them no way to fix. */
  function describeVoice(f) {
    const spans = f?.narration?.spans ?? [];
    const recorded = spans.filter((s) => s.voAssetId).length;
    $("vostatus").textContent = spans.length
      ? recorded === 0
        ? `${spans.length} spans, none recorded — this film is silent`
        : recorded < spans.length
          ? `${recorded}/${spans.length} spans recorded`
          : `${recorded} spans recorded · ${f.narration.voice ?? "unknown voice"}`
      : "";
    if (f?.narration?.voice) $("voice").value = f.narration.voice;
    $("record").textContent = recorded > 0 ? "Record it again" : "Record the narration";
  }

  api
    .voices()
    .then((r) => {
      for (const v of r.voices ?? []) {
        const o = document.createElement("option");
        o.value = v.id;
        o.textContent = `${v.label} — ${v.note}`;
        $("voice").append(o);
      }
    })
    .catch(() => {
      $("voice").disabled = true;
      $("record").disabled = true;
      $("vostatus").textContent = "voices unavailable";
    });

  $("record").addEventListener("click", async () => {
    const voice = $("voice").value;
    if (!voice) {
      $("vostatus").textContent = "choose a voice first";
      return;
    }
    stop();
    $("record").disabled = true;
    try {
      const done = await api.narrateAndWait(id, voice, (p) => {
        $("vostatus").textContent =
          p.state === "done"
            ? "measuring…"
            : `speaking ${p.spoken ?? 0}/${p.spans ?? "?"} spans…`;
      });
      // RELOAD THE CUT. The film's plan is fetched once when the view
      // opens, so a film narrated while open would have gone on playing
      // the silent plan until it was opened again from FILMS — which is
      // exactly the gap this button would otherwise have shipped with.
      await load();
      $("vostatus").textContent =
        `${done.spoken}/${done.spans} spans · ${done.measured} measured` +
        (done.failures?.length ? ` · ${done.failures.length} failed` : "");
      for (const f of done.failures ?? []) {
        $("warnings").insertAdjacentHTML("beforeend", `<p class="warn">${escape(f)}</p>`);
      }
    } catch (err) {
      $("vostatus").textContent = err.message;
    }
    $("record").disabled = false;
  });

  /** Draw the film at an absolute time and move the bar there. The one
   *  render path every interaction shares — play ticks, seeks, drags and
   *  the initial frame all go through here, so there is no way for the
   *  picture, the bar and the playhead to disagree. */
  function renderAt(ms) {
    positionMs = Math.max(0, Math.min(cut.durationMs, ms));
    if (renderer) {
      renderThreeJSFrame(positionMs);
    } else {
      drawFrame(ctx, film, Math.round((positionMs / 1000) * cut.fps));
    }
    $("played").style.width = `${(positionMs / cut.durationMs) * 100}%`;
  }

  /** Pause where it stands. The playhead survives — Play continues from
   *  here, which is the entire difference from the old stop(). */
  function pause() {
    cancelAnimationFrame(raf);
    raf = 0;
    stopVoice();
    $("play").textContent = "Play";
  }

  /** Stop for flows that genuinely restart — reroll, re-record, export. */
  function stop() {
    pause();
    positionMs = 0;
  }

  async function playFrom(ms) {
    pause();
    positionMs = Math.max(0, Math.min(cut.durationMs, ms));
    $("play").textContent = "Pause";
    startedAt = performance.now() - positionMs;
    // scheduleVoice was built for exactly this: spans already past are
    // skipped and one mid-sentence starts partway in, so the voice lands
    // where the picture landed.
    if (cut.voice) await playVoice(cut, positionMs);
    const tick = () => {
      const ms2 = performance.now() - startedAt;
      if (ms2 >= cut.durationMs) {
        renderAt(cut.durationMs);
        pause();
        positionMs = 0; // the NEXT play starts over; the bar shows the end
        return;
      }
      renderAt(ms2);
      raf = requestAnimationFrame(tick);
    };
    tick();
  }

  $("play").addEventListener("click", () => {
    if (raf) return pause();
    playFrom(positionMs >= cut.durationMs ? 0 : positionMs);
  });

  /* ── the scrubber ──────────────────────────────────────────────────
   *
   * Pointer events, not click: a click-only handler cannot drag, and a
   * seek that does not survive into playback is a still-frame viewer, not
   * a scrubber. Press anywhere on the bar to jump, drag to scrub with the
   * frame following live, release to resume playing if the film was
   * playing when you grabbed it. */
  const progress = $("played").parentElement;
  let wasPlaying = false;
  const seekPct = (e) => {
    const rect = progress.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  };
  progress.addEventListener("pointerdown", (e) => {
    if (!cut || (!film && !renderer)) return;
    e.preventDefault();
    wasPlaying = raf !== 0;
    pause();
    progress.setPointerCapture(e.pointerId);
    renderAt(seekPct(e) * cut.durationMs);
  });
  progress.addEventListener("pointermove", (e) => {
    if (!cut || !progress.hasPointerCapture(e.pointerId)) return;
    renderAt(seekPct(e) * cut.durationMs);
  });
  progress.addEventListener("pointerup", (e) => {
    if (!cut || !progress.hasPointerCapture(e.pointerId)) return;
    progress.releasePointerCapture(e.pointerId);
    if (wasPlaying) playFrom(positionMs);
  });

  $("reroll").addEventListener("click", async () => {
    stop();
    $("status").textContent = "re-rolling…";
    // A new seed costs no model call and no narration — the editorial
    // reading is frozen. Only the composition is re-derived.
    await api.settings(id, { seed: "new" });
    await load();
    $("status").textContent = "";
  });

  $("export").addEventListener("click", async () => {
    if (renderer) {
      $("status").textContent = "export not yet supported for Three.js backend";
      return;
    }

    stop();
    RENDER.cancel = false;
    $("export").disabled = true;
    const frames = Math.ceil((cut.durationMs / 1000) * cut.fps);
    const voice = cut.voice ? voiceTrack(cut) : null;
    if (voice) await voice.resume();
    const out = await encodeExact(ctx, canvas, {
      draw: (i) => drawFrame(ctx, film, i),
      frames,
      fps: cut.fps,
      w: canvas.width,
      h: canvas.height,
      voice,
      onProgress: (p) => {
        $("status").textContent = `${p.stage} ${Math.round(p.pct * 100)}%`;
        $("played").style.width = `${p.pct * 100}%`;
      },
    });
    $("export").disabled = false;
    if (out.cancelled) {
      $("status").textContent = "cancelled";
      return;
    }
    const url = URL.createObjectURL(out.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${id}.webm`;
    a.click();
    URL.revokeObjectURL(url);
    // Say what the file actually is. A duration that is silently wrong is
    // worse than one the operator was told about.
    $("status").textContent = out.durationExact
      ? `exported ${out.frames} frames${out.narrated ? ` with ${out.narrated} spans of voice` : ""}`
      : "exported — the film was too large to hold, so its duration is approximate";
  });

  await load();
}

const escape = (s) => String(s).replace(/[<>&]/g, (c) => `&#${c.charCodeAt(0)};`);
