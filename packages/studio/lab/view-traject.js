/* CANOPTICON — the trajectory.
 *
 * One line, thirty-four pixels tall. It is not a timeline and it is not a
 * chart: it is the film's shape — how far from the literal it travels, and
 * whether it breaks. Restraint is the point; the ribbon experiment said the
 * same thing six times over and became furniture.
 */
function runTrajectory() {
  const cv = document.getElementById("tcv");
  const host = document.getElementById("traject");
  if (!cv || !host) return;
  const ctx = cv.getContext("2d");
  const GAP = { cut: 3, bridge: 1, oneshot: 0, montage: 7 };

  function names() {
    const el = document.getElementById("tnames");
    if (!el) return;
    const comps = runOf().comps.filter((c) => !(window.FILM.cutScenes || []).includes(c.scene.id));
    el.innerHTML = comps.map((c) => `<div style="flex:${c.scene.dur}" class="${c.scene.id === APP.sel ? "on" : ""}">${stateVerb(c)}</div>`).join("");
    el.querySelectorAll("div").forEach((d) => {
      if (d.scrollWidth > d.clientWidth) d.textContent = "";
    });
  }
  names();

  function paint() {
    const f = window.FILM;
    const W = cv.width / 2,
      H = 34,
      pad = 6;
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const comps = runOf().comps.filter((c) => !(f.cutScenes || []).includes(c.scene.id));
    if (!comps.length) return;
    const gap = GAP[f.continuity] ?? 3;
    const y = (v) => H - pad - v * (H - pad * 2);
    const smooth = (t) => t * t * (3 - 2 * t);
    const nodes = comps.map((c) => ({ mid: (c.scene.t0 + c.scene.t1) / 2, v: c.abstraction }));
    const valueAt = (time) => {
      let i = 0;
      while (i < nodes.length - 1 && nodes[i + 1].mid < time) i++;
      const a = nodes[Math.max(0, i)],
        b = nodes[Math.min(nodes.length - 1, i + 1)];
      if (b.mid === a.mid) return a.v;
      return a.v + (b.v - a.v) * smooth(Math.max(0, Math.min(1, (time - a.mid) / (b.mid - a.mid))));
    };
    // ground line
    ctx.strokeStyle = "#22262a";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, H - 0.5);
    ctx.lineTo(W, H - 0.5);
    ctx.stroke();
    // act ticks
    ctx.strokeStyle = "#2e343a";
    f.acts.forEach((a) => {
      if (a.span[0] <= 0) return;
      const x = Math.round(a.span[0] * W) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    });
    // the line
    const segs = f.continuity === "oneshot"
      ? [[0, W]]
      : comps.map((c) => [(c.scene.t0 / f.runtime) * W + gap / 2, (c.scene.t1 / f.runtime) * W - gap / 2]);
    ctx.lineWidth = 1.4;
    ctx.lineCap = "round";
    segs.forEach(([x0, x1], i) => {
      const sel = f.continuity !== "oneshot" && comps[i] && comps[i].scene.id === APP.sel;
      ctx.strokeStyle = sel ? "#a9c6b0" : "#7d878a";
      ctx.beginPath();
      for (let x = x0; x <= x1 + 0.01; x += 1.5) {
        const yy = y(valueAt((x / W) * f.runtime));
        x === x0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
      }
      ctx.stroke();
    });
    // playhead
    const px = (PLAY.t / f.runtime) * W;
    ctx.strokeStyle = "rgba(169,198,176,.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, H);
    ctx.stroke();
    ctx.fillStyle = "#c2dbc8";
    ctx.beginPath();
    ctx.arc(px, y(valueAt(PLAY.t)), 2.8, 0, 7);
    ctx.fill();
  }

  const seek = (e) => {
    const r = cv.getBoundingClientRect();
    PLAY.t = clamp((e.clientX - r.left) / r.width, 0, 0.999) * window.FILM.runtime;
    const s = liveScenes().find((x) => PLAY.t >= x.t0 && PLAY.t < x.t1);
    if (s && s.id !== APP.sel) {
      setCurrent(s.id, false);
      names();
      bringCurrentIntoView(true);
    }
  };
  cv.onpointerdown = (e) => {
    cv.setPointerCapture(e.pointerId);
    seek(e);
    cv.onpointermove = (ev) => ev.buttons && seek(ev);
    cv.onpointerup = () => (cv.onpointermove = null);
  };

  paint();
  let last = "";
  loop(() => {
    paint();
    const k = APP.sel + (window.FILM.cutScenes || []).length + window.FILM.runtime.toFixed(2);
    if (k !== last) {
      last = k;
      names();
    }
  });
}
Object.assign(window, { runTrajectory });
