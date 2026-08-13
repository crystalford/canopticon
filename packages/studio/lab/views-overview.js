/* CANOPTICON — OVERVIEW. The whole film, as pictures.
 *
 * Every other view in this instrument answers a question about ONE scene.
 * The question a director actually asks first is about the film:
 *
 *   Does this look like anything?
 *
 * And the specific failure that question catches is the one this system
 * has been reported for twice: "it seems like it's only doing the same
 * text effect", and "10%... a lot of repetitive titles". Both were true
 * and both were invisible from inside the instrument, because nothing
 * showed more than one frame at a time. A compiler can report twelve
 * distinct chains and eighty-eight distinct hashes and still be making a
 * film where scenes eight through fourteen are indistinguishable, and
 * every number on the Compile view will be correct about it.
 *
 * So this renders EVERY scene, at a real frame from its own chain, in a
 * grid. It is the cheapest possible editorial instrument and the only one
 * that answers the question by showing rather than by counting.
 *
 * IT RENDERS THE REAL CHAIN. Not a thumbnail of a placeholder, not the
 * first primitive, not an icon per construction — the same executor the
 * Preview and the render use, at a small size, sampled at a fixed
 * fraction of each scene's own duration. A contact sheet of approximations
 * would be a picture of a film rather than a picture of THIS film, which
 * is the exact class of mistake the Preview used to make.
 *
 * It also names the repetition rather than leaving it to be noticed: a run
 * of scenes built the same way is marked, with what to do about it. The
 * engine converging is not a bug — a film should have a grammar — but it
 * should be a decision.
 */

const SHEET = {
  /** Where in each scene to sample. 0.4 rather than 0 because a great many
   *  chains open on an empty frame and resolve into something; a contact
   *  sheet of first frames would report an entire film as black. */
  at: 0.4,
  cols: 0,
  built: false,
};

/** Runs of three or more consecutive scenes built the same way.
 *
 *  Three is the threshold because two in a row reads as a pair and four
 *  reads as a section. Reported with the construction named, so the
 *  recommendation can be specific rather than "add variety". */
function repetitionRuns(scenes, comps) {
  const runs = [];
  let start = 0;
  for (let i = 1; i <= scenes.length; i++) {
    const same =
      i < scenes.length && signatureOf(scenes[i], comps) === signatureOf(scenes[start], comps);
    if (!same) {
      if (i - start >= 3) {
        runs.push({ from: start, to: i - 1, what: signatureOf(scenes[start], comps) });
      }
      start = i;
    }
  }
  return runs;
}

/** What makes two scenes "the same" for this purpose: what was BUILT, not
 *  which primitives implement it. Two fixtures with different operators
 *  are a variation on one idea; a fixture and a chart are two ideas. */
function signatureOf(scene, comps) {
  if (scene.idea) return scene.idea.construction;
  // No constructed program — a scene planned from a ratified reading, or
  // the built-in example, which has no constructor behind it at all. Fall
  // back to what it actually starts with, which is still a description a
  // person can act on. "unbuilt" only when there is genuinely nothing.
  const nodes = comps?.get(scene.id)?.nodes || [];
  const head = nodes.length
    ? nodes.slice(0, 2).map((n) => n.prim)
    : (scene.chain || []).slice(0, 2);
  return head.join(" → ") || "unbuilt";
}

function viewOverview(root) {
  const scenes = F3.scenes || [];
  // THE SAME SOURCE THE PREVIEW USES. `dryRun()` is where composed nodes
  // with their real parameters live — for a project it adopts the Worker's
  // composition, and for the built-in example it composes locally. Reading
  // `scene.chain` instead gave sixteen cells that could not be built,
  // because a scene carries the chain's IDS and not its parameters.
  const comps = new Map((dryRun().comps || []).map((c) => [c.scene.id, c]));

  const runs = repetitionRuns(scenes, comps);
  const flagged = new Set();
  for (const r of runs) for (let i = r.from; i <= r.to; i++) flagged.add(i);

  // The film's own vocabulary, counted. Not a palette — a description of
  // what this particular film turned out to be made of.
  const vocab = new Map();
  for (const s of scenes) {
    const key = s.idea ? s.idea.construction : signatureOf(s, comps);
    vocab.set(key, (vocab.get(key) ?? 0) + 1);
  }
  const most = Math.max(1, ...vocab.values());

  root.innerHTML = `
  <div class="vhead"><h2>Overview</h2>
    <span class="k">${scenes.length} SHOTS · ${vocab.size} KIND${vocab.size === 1 ? "" : "S"} OF THING ·
      ${runs.length ? `${runs.length} REPEATED RUN${runs.length === 1 ? "" : "S"}` : "NO RUNS OF THREE"}</span></div>
  <div class="pad">
    <div class="sec">
      <span class="k">What this film is made of</span>
      <div class="vocab">${[...vocab.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(
          ([k, n]) => `<div class="vocab-row">
            <span>${esc(k)}</span>
            <i style="width:${Math.round((n / most) * 100)}%"></i>
            <b class="mono">${n}</b></div>`,
        )
        .join("")}</div>
      ${
        runs.length
          ? `<div class="runs">${runs
              .map(
                (r) => `<div class="run">
                  <b>SHOTS ${String(r.from + 1).padStart(2, "0")}–${String(r.to + 1).padStart(2, "0")}</b>
                  ${r.to - r.from + 1} in a row built as <b>${esc(r.what)}</b>.
                  <span class="mono">A grammar is a decision; a run is what it looks like when
                  nobody made one. Open a shot and take one of its alternatives, or move the curve
                  under this stretch.</span></div>`,
              )
              .join("")}</div>`
          : `<p class="mono films-hint">No three consecutive shots are built the same way.</p>`
      }
    </div>

    <div class="sec secline">
      <span class="k">Every shot, at ${Math.round(SHEET.at * 100)}% of its own length</span>
      <div class="sheet" id="sheet">${scenes
        .map(
          (s, i) => `<figure class="cell ${flagged.has(i) ? "rep" : ""}" data-cell="${i}">
            <canvas width="240" height="135"></canvas>
            <figcaption>
              <b class="mono">${String(i + 1).padStart(2, "0")}</b>
              <span>${esc(s.idea ? s.idea.construction : signatureOf(s, comps))}</span>
              <i>${esc(s.label || "")}</i>
            </figcaption>
          </figure>`,
        )
        .join("")}</div>
      <p class="mono films-hint" id="sheet-msg">rendering…</p>
    </div>
  </div>`;

  for (const cell of root.querySelectorAll("[data-cell]")) {
    cell.onclick = () => {
      const scene = scenes[Number(cell.dataset.cell)];
      if (!scene) return;
      APP.sel = scene.id;
      PLAY.t = scene.t0 + (scene.t1 - scene.t0) * SHEET.at;
      go("preview");
    };
  }

  paintSheet(root, scenes, comps);
}

/** Draw every cell, yielding between them.
 *
 *  An eighty-scene film is eighty chains instantiated and run, which is
 *  seconds of work. Done in one loop it locks the page and looks like a
 *  hang; done one per frame it fills in visibly, which is both faster to
 *  first useful information and honest about what it is doing. */
async function paintSheet(root, scenes, comps) {
  const cells = [...root.querySelectorAll("[data-cell] canvas")];
  const msg = root.querySelector("#sheet-msg");
  let failed = 0;

  for (let i = 0; i < cells.length; i++) {
    const canvas = cells[i];
    const scene = scenes[i];
    if (!canvas || !scene) continue;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#0d0f11";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    try {
      const comp = comps.get(scene.id);
      const nodes = (comp?.nodes || []).map((n) => ({
        id: n.prim,
        params: n.params,
        seed: n.params?.seed,
        ...(n.b ? { b: n.b } : {}),
      }));
      if (nodes.length === 0) throw new Error("nothing composed for this scene");
      const dur = Math.max(0.2, scene.t1 - scene.t0);
      const built = buildChain(nodes, canvas.width, canvas.height, dur);
      if (built.errors.length) throw new Error(built.errors[0]);
      ctx.drawImage(built.run(dur * SHEET.at), 0, 0);
    } catch (err) {
      // Degrade, flag, continue — one scene that will not build must not
      // cost the sheet, and it must not look like a black frame either.
      failed++;
      ctx.fillStyle = "#d8624a";
      ctx.font = '500 9px "JetBrains Mono",monospace';
      ctx.fillText(String(err.message).slice(0, 34), 8, 18);
    }

    if (msg) msg.textContent = `rendering… ${i + 1} of ${cells.length}`;
    // One cell per animation frame: the sheet fills in rather than the
    // page stopping.
    await new Promise((r) => requestAnimationFrame(r));
  }

  if (msg) {
    msg.textContent = failed
      ? `${cells.length} shots · ${failed} could not be built and say why on the frame`
      : `${cells.length} shots · click one to open it`;
  }
}

Object.assign(window, { viewOverview, repetitionRuns });
