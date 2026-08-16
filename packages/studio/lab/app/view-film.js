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
import { api } from "./api.js";

export async function viewFilm(root, go, id) {
  root.innerHTML = `
    <h1 id="title">…</h1>
    <p class="sub" id="sub"></p>
    <canvas id="stage" width="1280" height="720"></canvas>
    <div class="bar"><i id="played"></i></div>
    <div class="actions">
      <button id="play">Play</button>
      <button class="ghost" id="reroll">Another seed</button>
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

  /** A film the previous engine made. Its essay survives; nothing else in
   *  it means anything now. Offer the re-read rather than a dead end — and
   *  make it a button, because a page load must not spend a model call. */
  function offerReread(info) {
    $("title").textContent = info.title || "A film from the previous engine";
    $("sub").textContent = `${info.words} words · made before the engine was rebuilt`;
    canvas.style.display = "none";
    $("play").style.display = "none";
    $("reroll").style.display = "none";
    $("export").style.display = "none";
    const btn = document.createElement("button");
    btn.textContent = "Re-read with the new engine";
    $("play").parentElement.prepend(btn);
    $("warnings").innerHTML =
      `<p class="warn">the essay is kept and re-read; the old version stays in the film's history</p>
       <p class="warn">the previous recordings cannot carry over — record it again to hear it</p>`;
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      $("status").textContent = "reading the essay…";
      try {
        await api.reread(id);
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
    // The faces are the material. Drawing before they load renders a
    // system fallback and everything you judge is the wrong typeface.
    await document.fonts.ready;
    film = prepareFilm(cut, buildStages(cut));
    $("sub").textContent =
      `${cut.beats.length} beats · ${(cut.durationMs / 1000).toFixed(1)}s · seed ${cut.seed} · ${meta.editorial}`;
    $("warnings").innerHTML = (cut.warnings ?? [])
      .map((w) => `<p class="warn">${escape(w)}</p>`)
      .join("");
    if (cut.voice) await loadVoice(cut).catch(() => undefined);
    drawFrame(ctx, film, 0);
    describeVoice(meta.film);
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

  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
    stopVoice();
    $("play").textContent = "Play";
  }

  $("play").addEventListener("click", async () => {
    if (raf) return stop();
    $("play").textContent = "Stop";
    startedAt = performance.now();
    if (cut.voice) await playVoice(cut, 0);
    const tick = () => {
      const ms = performance.now() - startedAt;
      if (ms >= cut.durationMs) return stop();
      drawFrame(ctx, film, Math.round((ms / 1000) * cut.fps));
      $("played").style.width = `${(ms / cut.durationMs) * 100}%`;
      raf = requestAnimationFrame(tick);
    };
    tick();
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
