/* CANOPTICON — RENDER. The end of the loop.
 *
 * A film you cannot take away is a demo. This is the only surface that
 * produces a file, so it states exactly what it will make BEFORE it runs, and
 * it reports what it actually made — including the two ways a browser render
 * can be less than exact.
 */
const ROPT = { size: "720p", fps: 30, captions: true, narration: true };
const SIZES = { "720p": [1280, 720], "1080p": [1920, 1080] };

function openRender() {
  if (document.getElementById("sheet")) return;
  const f = window.FILM;
  const el = document.createElement("div");
  el.id = "sheet";
  el.innerHTML = '<div class="sheetbox panel" id="sheetbox"></div>';
  document.body.appendChild(el);
  el.onclick = (e) => { if (e.target === el) closeSheet(); };
  paintRender();
}
function closeSheet() {
  if (RENDER.running) return toast("A render is running \u2014 cancel it first");
  const el = document.getElementById("sheet");
  if (el) el.remove();
}

function paintRender(prog, done) {
  const box = document.getElementById("sheetbox");
  if (!box) return;
  const f = window.FILM;
  const [w, h] = SIZES[ROPT.size];
  const frames = Math.ceil(f.runtime * ROPT.fps);
  const plan = f.plan || window.PLAN || null;
  const nar = plan && window.narrationStatus ? narrationStatus(plan) : null;
  const voiced = nar ? nar.narrated : 0;

  if (done) {
    box.innerHTML = `<div class="head"><span class="col"><span class="eyebrow">Render</span><h3>${esc(f.title)}</h3></span></div>
    <div class="rdone"><p class="lead">The film is made \u2014 ${done.frames} frames, ${fmt(f.runtime)}, ${done.narrated ? done.narrated + " narrated moments" : "silent"}.</p>
    <p class="note">${
      done.durationExact === false
        ? "This film was too large to time exactly, so the file runs longer than the film does \u2014 the pictures are right, the clock is not."
        : done.late
          ? `The file runs to ${fmt(f.runtime)}, give or take: ${done.late} frames arrived late.`
          : `The file runs to ${fmt(f.runtime)}, exactly \u2014 every frame written once, at its own time.`
    }</p>
    <div class="ract"><a class="b pri big" id="dl" download="${esc(f.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase())}.webm">Download the film</a>
    <button class="b" id="again">Render again</button></div></div>`;
    const a = box.querySelector("#dl");
    a.href = URL.createObjectURL(done.blob);
    box.querySelector("#again").onclick = () => paintRender();
    return;
  }
  if (prog) {
    box.innerHTML = `<div class="head"><span class="col"><span class="eyebrow">Rendering</span><h3>${esc(f.title)}</h3></span><span class="meta">${Math.round(prog.pct * 100)}%</span></div>
    <p class="lead">${esc(prog.stage)}</p>
    <div class="rbar"><s style="width:${(prog.pct * 100).toFixed(1)}%"></s></div>
    <p class="note">A render is paced by its own sound, so it takes about as long as the film runs. Leave this open.</p>
    <div class="ract"><button class="b" id="cancel">Cancel</button></div>`;
    box.querySelector("#cancel").onclick = () => { RENDER.cancel = true; toast("Cancelled"); };
    return;
  }
  box.innerHTML = `<div class="head"><span class="col"><span class="eyebrow">Render</span><h3>Make the file</h3></span>
    <span class="meta">${fmt(f.runtime)} \u00b7 ${frames} frames</span></div>
  <div class="cchoices" style="padding:0 0 var(--s5)">
    <div class="crow"><span class="clabel">Size</span><div class="segs" data-r="size">${Object.keys(SIZES).map((k) => `<button data-opt="${k}" class="${ROPT.size === k ? "on" : ""}">${k} \u00b7 ${SIZES[k][0]}\u00d7${SIZES[k][1]}</button>`).join("")}</div></div>
    <div class="crow"><span class="clabel">Rate</span><div class="segs" data-r="fps">${[24, 30, 60].map((k) => `<button data-opt="${k}" class="${ROPT.fps === k ? "on" : ""}">${k} fps</button>`).join("")}</div></div>
    <div class="crow"><span class="clabel">Captions</span><div class="segs" data-r="captions">${[["on", true], ["off", false]].map(([l, v]) => `<button data-opt="${v}" class="${ROPT.captions === v ? "on" : ""}">${l}</button>`).join("")}</div></div>
  </div>
  <div class="rfacts">${[["Format", "WebM \u00b7 VP9"], ["Frames", frames + " at " + ROPT.fps + " fps"], ["Voice", voiced ? voiced + " moments narrated" : "silent \u2014 no voice bought"], ["Cost", "$0.00 \u2014 rendered in this page"]].map(([k, v]) => `<span class="fact"><span>${k}</span><i>${v}</i></span>`).join("")}</div>
  ${plan ? "" : '<div class="notice" style="margin-top:var(--s4)"><i class="dot clay"></i><span>This film has no compiled plan in the page \u2014 the example is composed live here rather than on the server. Make a film from your own writing and this button produces a file.</span></div>'}
  <div class="ract"><button class="b pri big" id="run" ${plan ? "" : "disabled"}>Render the film</button><button class="b" id="close2">Not now</button></div>`;
  box.querySelectorAll("[data-r]").forEach((row) => row.querySelectorAll("[data-opt]").forEach((b) => (b.onclick = () => {
    const k = row.dataset.r, v = b.dataset.opt;
    ROPT[k] = k === "fps" ? +v : k === "captions" ? v === "true" : v;
    paintRender();
  })));
  box.querySelector("#close2").onclick = closeSheet;
  const run = box.querySelector("#run");
  if (plan) run.onclick = async () => {
    try {
      const out = await renderFilm(plan, { width: w, height: h, fps: ROPT.fps, captions: ROPT.captions, narration: ROPT.narration, onProgress: (p) => paintRender(p) });
      paintRender(null, out);
    } catch (e) { paintRender(); toast("Render failed \u2014 " + e.message); }
  };
}
Object.assign(window, { openRender, closeSheet, paintRender, ROPT });
