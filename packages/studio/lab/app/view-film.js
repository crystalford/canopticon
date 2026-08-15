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
    <div id="warnings"></div>`;

  const $ = (s) => root.querySelector(`#${s}`);
  const canvas = $("stage");
  const ctx = canvas.getContext("2d");
  $("back").addEventListener("click", () => go(""));

  let film = null;
  let cut = null;
  let raf = 0;
  let startedAt = 0;

  async function load() {
    const meta = await api.film(id);
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
  }

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
