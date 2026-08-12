/* CANOPTICON — the Preview view. A compile plan, played.
 *
 * The compiler has always been able to describe a film in complete detail —
 * which primitives, which parameters, which window, cut how — and has never
 * once shown you one. Every claim about this system so far has been
 * measured rather than watched. This is the surface where that changes, and
 * where a treatment that reads fine as a type signature turns out to look
 * like nothing at all.
 *
 * The player invents NOTHING. Every number it uses was decided by the
 * solver, the composition engine or the shot planner, and each is
 * attributable on screen: the inspector names the chain, the cut, and the
 * engine's own reason for every primitive in it. A preview you cannot
 * interrogate is a demo.
 *
 * It runs entirely in the browser against a static plan, so it works from a
 * pasted JSON with no server — which is the same reason the rest of the Lab
 * is a static page.
 */

const els = {};
let plan = null;
let scenes = [];
let playing = false;
let clockMs = 0;
let lastFrame = 0;
let soloIndex = -1;

const W = 960;
const H = 540;

function fmt(ms) {
  const s = Math.max(0, ms) / 1000;
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}.${String(Math.floor((s % 1) * 10))}`;
}

/** Instantiate every scene once, up front.
 *
 *  A chain holds state — particle positions, creature bodies — so building
 *  it per frame would reset all motion to its first step. Building it per
 *  scene ENTRY would do the same thing every time you scrubbed backwards.
 *  So they are built once and the clock decides which is on screen, which
 *  is also what makes scrubbing honest: the frame you see at 42s is the
 *  frame the film has at 42s, not the frame you get by arriving there. */
function buildAll(p) {
  const out = [];
  for (const scene of p.scenes) {
    const chain = scene.chain.map((n) => ({ id: n.id, params: n.params, seed: n.seed }));
    const shots = (scene.shots || []).map((s) => ({
      startMs: s.startMs - scene.startMs,
      endMs: s.endMs - scene.startMs,
      params: s.params || {},
    }));
    // A single-shot scene is built as a plain chain; more than one and the
    // sequence builder gives each shot its own instance, because at a cut
    // state resets.
    const built =
      shots.length > 1
        ? buildSequence(chain, shots, W, H)
        : buildChain(chain, W, H, (scene.endMs - scene.startMs) / 1000);
    out.push({ scene, built, single: shots.length <= 1 });
  }
  return out;
}

function sceneAt(ms) {
  if (soloIndex >= 0) return scenes[soloIndex] ?? null;
  for (const s of scenes) {
    if (ms >= s.scene.startMs && ms < s.scene.endMs) return s;
  }
  return scenes[scenes.length - 1] ?? null;
}

function draw() {
  const ctx = els.canvas.getContext("2d");
  const active = sceneAt(clockMs);
  if (!active) {
    ctx.fillStyle = "#0d0f11";
    ctx.fillRect(0, 0, W, H);
    return;
  }

  const { scene, built, single } = active;
  // Solo holds the scene's own clock rather than the film's, so a scene can
  // be studied without scrubbing to find it.
  const localMs = soloIndex >= 0 ? clockMs % Math.max(1, scene.endMs - scene.startMs) : clockMs - scene.startMs;

  if (built.errors && built.errors.length) {
    ctx.fillStyle = "#0d0f11";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#d8624a";
    ctx.font = '500 13px "JetBrains Mono",monospace';
    // A chain that does not typecheck is REPORTED on the frame, not skipped
    // silently. Degrade, flag, continue.
    built.errors.slice(0, 6).forEach((e, i) => ctx.fillText(e, 24, 60 + i * 20));
  } else {
    const buf = single ? built.run(localMs / 1000) : built.run(localMs);
    ctx.drawImage(buf, 0, 0);
  }

  paintChrome(ctx, scene, localMs, active);
  paintInspector(scene, localMs, active);
}

/** The prose, and where you are. Deliberately on the frame rather than
 *  beside it: judging whether a treatment serves its sentence means seeing
 *  both at once. */
function paintChrome(ctx, scene, localMs, active) {
  const g = ctx.createLinearGradient(0, H - 120, 0, H);
  g.addColorStop(0, "rgba(13,15,17,0)");
  g.addColorStop(1, "rgba(13,15,17,.92)");
  ctx.fillStyle = g;
  ctx.fillRect(0, H - 120, W, 120);

  ctx.font = '500 10px "JetBrains Mono",monospace';
  ctx.fillStyle = "rgba(155,163,170,.75)";
  const shotIdx = active.single ? 0 : (active.built.at ? active.built.at(localMs) : 0);
  const shots = scene.shots.length || 1;
  ctx.fillText(
    `${scene.sceneId} · ${scene.actId} · ${scene.tier} · SHOT ${shotIdx + 1}/${shots} · ${scene.determinism}`,
    22,
    H - 74,
  );

  ctx.font = '400 15px "Space Grotesk",sans-serif';
  ctx.fillStyle = "#eef1f3";
  wrap(ctx, scene.text, 22, H - 50, W - 44, 19, 2);
}

function wrap(ctx, text, x, y, maxW, lh, maxLines) {
  const words = String(text).split(/\s+/);
  let line = "";
  let row = 0;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y + row * lh);
      row++;
      if (row >= maxLines) {
        ctx.fillText("…", x, y + row * lh);
        return;
      }
      line = word;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, y + row * lh);
}

/** Why this shot looks the way it does. The composition engine already
 *  records a reason per primitive; showing them is the difference between
 *  a preview and a black box. */
function paintInspector(scene, localMs, active) {
  const shotIdx = active.single ? 0 : (active.built.at ? active.built.at(localMs) : 0);
  const shot = scene.shots[shotIdx];
  const overrides = shot && shot.params ? Object.entries(shot.params) : [];
  els.inspector.innerHTML = `
    <div class="ins-head">${escapeHtml(scene.label || scene.sceneId)}</div>
    <div class="ins-sig">${scene.chain.map((n) => escapeHtml(n.id)).join(" → ")}</div>
    <div class="ins-meta">${scene.shots.length || 1} shot${(scene.shots.length || 1) === 1 ? "" : "s"}
      · ${((scene.endMs - scene.startMs) / 1000).toFixed(1)}s
      · ${scene.costMsPerFrame.toFixed(1)}ms/frame</div>
    ${
      overrides.length
        ? `<div class="ins-shot">shot ${shotIdx + 1} — ${overrides
            .map(([k, v]) => `${escapeHtml(k)} <b>${escapeHtml(String(v))}</b>`)
            .join(" · ")}</div>`
        : ""
    }
    <ul class="ins-why">${scene.reasons.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>`;
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
}

function paintTimeline() {
  const t = els.timeline;
  t.innerHTML = "";
  if (!plan) return;
  for (const [i, s] of plan.scenes.entries()) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = `tl-scene tl-${s.tier.toLowerCase()}`;
    el.style.flexGrow = String(Math.max(1, s.endMs - s.startMs));
    el.title = `${s.sceneId} · ${s.text.slice(0, 90)}`;
    // Cuts drawn inside the scene block, so the film's EDIT is visible at a
    // glance rather than only its scene structure.
    el.innerHTML = (s.shots || [])
      .slice(1)
      .map(
        (sh) =>
          `<i style="left:${(((sh.startMs - s.startMs) / Math.max(1, s.endMs - s.startMs)) * 100).toFixed(2)}%"></i>`,
      )
      .join("");
    el.addEventListener("click", () => {
      soloIndex = -1;
      clockMs = s.startMs;
      draw();
      markActive();
    });
    el.addEventListener("dblclick", () => {
      soloIndex = soloIndex === i ? -1 : i;
      clockMs = soloIndex >= 0 ? 0 : s.startMs;
      els.solo.textContent = soloIndex >= 0 ? `SOLO ${s.sceneId}` : "";
      draw();
      markActive();
    });
    t.appendChild(el);
  }
  markActive();
}

function markActive() {
  const active = sceneAt(clockMs);
  [...els.timeline.children].forEach((el, i) => {
    el.classList.toggle("on", active != null && plan.scenes[i] === active.scene);
  });
}

function tick(now) {
  if (playing) {
    const dt = lastFrame ? now - lastFrame : 16;
    clockMs += dt;
    const end = soloIndex >= 0 ? Number.POSITIVE_INFINITY : plan.durationMs;
    if (clockMs >= end) clockMs = 0;
    els.scrub.value = String(Math.min(clockMs, plan.durationMs));
    markActive();
  }
  lastFrame = now;
  els.clock.textContent = `${fmt(clockMs)} / ${fmt(plan ? plan.durationMs : 0)}`;
  draw();
  requestAnimationFrame(tick);
}

/* ── EXPORT ───────────────────────────────────────────────────────────
 *
 * The film, as a file.
 *
 * Every compile until now produced a PLAN, and nothing anywhere in Studio
 * wrote a video — no encoder, no frames-to-file step, not even a stub. So
 * "essay in, film out" stopped one step short of the noun in its own name.
 *
 * This records the canvas as it plays. It is deliberately the cheap version
 * and it is honest about which:
 *
 *   REAL TIME. The recording takes as long as the film. A 6-minute essay
 *   costs 6 minutes of wall clock, because MediaRecorder captures a live
 *   stream rather than rendering frames as fast as they compute.
 *
 *   REAL-TIME DETERMINISM, NOT FRAME DETERMINISM. Frames are captured on
 *   the browser's clock, so a slow frame is a dropped frame and two exports
 *   of the same plan are not byte-identical. That is L2 honestly stated,
 *   not L3 — see standing rule 7. A frame-accurate export means driving the
 *   chain by frame index and encoding offline, which is a real piece of
 *   work and is not this.
 *
 * What it is good for is the thing that has been missing: watching the
 * whole film somewhere other than this tab, and sending it to someone.
 */
let recorder = null;
let recordedChunks = [];

function startExport() {
  if (!plan || recorder) return;
  const stream = els.canvas.captureStream(30);
  // VP9 where the browser has it, VP8 as the fallback that everything has.
  const mime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((m) =>
    MediaRecorder.isTypeSupported(m),
  );
  if (!mime) {
    els.stats.textContent = "this browser cannot record a canvas — export unavailable";
    return;
  }
  recordedChunks = [];
  recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) recordedChunks.push(e.data);
  };
  recorder.onstop = () => {
    const blob = new Blob(recordedChunks, { type: "video/webm" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(plan.title || "film").replace(/[^\w-]+/g, "-").slice(0, 60)}.webm`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    recorder = null;
    els.record.textContent = "EXPORT";
    els.stats.textContent = `exported ${(blob.size / 1e6).toFixed(1)}MB · ${mime}`;
  };

  // Always from the top, always the whole film: an export that started
  // wherever the scrubber happened to be would be a clip, and would be
  // silently mislabelled as the film.
  clockMs = 0;
  soloIndex = -1;
  els.solo.textContent = "";
  playing = true;
  els.play.textContent = "PAUSE";
  els.record.textContent = "STOP · RECORDING";
  recorder.start(1000);

  const stopAt = plan.durationMs + 400;
  const watch = setInterval(() => {
    if (!recorder) return clearInterval(watch);
    els.stats.textContent = `recording · ${fmt(clockMs)} of ${fmt(plan.durationMs)}`;
    if (clockMs >= stopAt || clockMs < 200 && recordedChunks.length > 2) {
      clearInterval(watch);
      playing = false;
      els.play.textContent = "PLAY";
      recorder.stop();
    }
  }, 250);
}

function load(p) {
  plan = p;
  scenes = buildAll(p);
  clockMs = 0;
  soloIndex = -1;
  els.scrub.max = String(p.durationMs);
  els.title.textContent = p.title || "Untitled";
  const bad = scenes.filter((s) => s.built.errors && s.built.errors.length).length;
  els.stats.textContent =
    `${p.scenes.length} scenes · ${fmt(p.durationMs)} · ${p.determinism} · ` +
    `peak ${p.peakCostMsPerFrame.toFixed(1)}ms/frame · ${p.ttsCalls} TTS calls` +
    (bad ? ` · ${bad} scenes failed to typecheck` : "");
  els.warnings.innerHTML = (p.warnings || [])
    .map((w) => `<li>${escapeHtml(w)}</li>`)
    .join("");
  paintTimeline();
}

function boot() {
  for (const id of [
    "canvas",
    "scrub",
    "clock",
    "title",
    "stats",
    "timeline",
    "inspector",
    "warnings",
    "play",
    "paste",
    "loadBtn",
    "solo",
    "record",
  ]) {
    els[id] = document.getElementById(id);
  }
  els.canvas.width = W;
  els.canvas.height = H;

  els.play.addEventListener("click", () => {
    playing = !playing;
    els.play.textContent = playing ? "PAUSE" : "PLAY";
  });
  els.scrub.addEventListener("input", () => {
    clockMs = Number(els.scrub.value);
    soloIndex = -1;
    els.solo.textContent = "";
    markActive();
  });
  els.record.addEventListener("click", () => {
    if (recorder) {
      playing = false;
      els.play.textContent = "PLAY";
      recorder.stop();
    } else {
      startExport();
    }
  });
  els.loadBtn.addEventListener("click", () => {
    try {
      load(JSON.parse(els.paste.value));
      els.paste.classList.remove("bad");
    } catch (err) {
      els.paste.classList.add("bad");
      els.stats.textContent = `could not read that plan — ${err.message}`;
    }
  });

  // A plan arrives one of three ways, in order of how a person actually
  // gets here: a project id from the front door, a plan URL, or pasted
  // JSON. The paste path is kept because the Lab is a static page and
  // stays useful with no server at all.
  const q = new URLSearchParams(location.search);
  const projectId = q.get("project");
  const src = q.get("plan");
  if (projectId) {
    els.stats.textContent = "compiling…";
    fetch(`/v1/project/${encodeURIComponent(projectId)}/film`)
      .then((r) => r.json())
      .then((p) => {
        if (p.error) throw new Error(p.error);
        load(p);
      })
      .catch((e) => {
        els.stats.textContent = `could not compile ${projectId} — ${e.message}`;
      });
  } else if (src) {
    fetch(src)
      .then((r) => r.json())
      .then(load)
      .catch((e) => {
        els.stats.textContent = `could not fetch ${src} — ${e.message}`;
      });
  }

  requestAnimationFrame(tick);
}

document.addEventListener("DOMContentLoaded", boot);
