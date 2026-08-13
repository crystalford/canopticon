/* CANOPTICON — THE SCORE. Composed, not chosen.
 *
 * `synth_bed` has declared "— → AUDIO" since the palette was written, and
 * it draws a picture of a synth bed. `sonify` declares DATA → AUDIO and
 * draws a picture of sonification. The AUDIO type is real, the render
 * already carries an audio track, and nothing in this instrument has ever
 * made a sound — the same shape of gap `gravity_field` had when it
 * declared FIELD and returned nothing.
 *
 * This is the sound. And it is composed the same way the picture is:
 *
 *   NOT   pick a track and lay it underneath
 *   BUT   read the film's own curves and synthesise what they imply
 *
 * There is no music model, no external provider, no audio asset. A drone
 * is three detuned oscillators through a filter; tension is the interval
 * between them; density is how much noise sits behind them; a pulse is an
 * envelope on a gain node. All of it is arithmetic, which means all of it
 * is DETERMINISTIC — same film, same seed, same score, which is the same
 * promise the picture makes and the reason this belongs in the compiler
 * rather than in a library.
 *
 * WHAT DRIVES IT. The film's existing state, not a new set of knobs:
 *
 *   visualDensity   → how much texture sits under the drone
 *   motionEnergy    → pulse rate and filter movement
 *   abstraction     → harmonic stability; consonant low, unstable high
 *   restraint       → the ceiling on all of it
 *   act             → the harmonic centre, so an act change is audible
 *
 * A director who drags the abstraction curve hears the film become less
 * sure of itself. That is the whole idea: one director model, two media.
 *
 * AND IT KNOWS WHEN TO STOP. A film that is continuously scored is a film
 * with no dynamics — the note that prompted this called it "visual
 * breathing" and it is truer of sound. The score ducks hard under
 * narration and drops to almost nothing on a scene the engine marked
 * contested, because the moment a claim is being reported is not the
 * moment to tell the audience how to feel about it.
 */

/** Seeded, because standing rule 4 has no exceptions and a score that
 *  differs between two renders of one film would break the same promise
 *  the picture keeps. */
function scoreRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The harmonic centre of each act, in Hz.
 *
 *  Deliberately low and deliberately close together: a documentary score
 *  that changes key audibly between acts is announcing its own structure,
 *  which is a thing scores do in trailers. These are a few semitones
 *  apart — felt rather than noticed. */
const CENTRES = [55, 58.27, 49, 61.74, 51.91];

/** Build a score for a film and return the transport for it.
 *
 *  Everything is scheduled against a single AudioContext clock, the same
 *  one the narration plays on, so the score and the voice cannot drift
 *  against each other or against the frames. */
function buildScore(plan, comps, ctx, destination, options) {
  const opts = options || {};
  const scenes = (plan && plan.scenes) || [];
  if (!ctx || scenes.length === 0) return null;

  const rand = scoreRandom(opts.seed ?? 20260813);
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(destination);

  // ── the drone. Three oscillators, detuned by a seeded few cents so the
  //    beating between them is the texture rather than an effect on top
  //    of it.
  const voices = [1, 1.5, 2].map((ratio, i) => {
    const osc = ctx.createOscillator();
    osc.type = i === 0 ? "sine" : "triangle";
    const gain = ctx.createGain();
    gain.gain.value = i === 0 ? 0.5 : 0.18 / i;
    osc.detune.value = (rand() - 0.5) * 14;
    osc.connect(gain).connect(master);
    return { osc, gain, ratio };
  });

  // ── the filter. One lowpass across the whole bed; its cutoff is where
  //    density and energy are actually heard.
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = 0.8;
  filter.frequency.value = 400;

  // ── texture. Seeded noise, looped, band-limited. This is what "density"
  //    sounds like — not more notes, more air.
  const seconds = 4;
  const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (rand() - 0.5) * 0.5;
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuf;
  noise.loop = true;
  const noiseGain = ctx.createGain();
  noiseGain.gain.value = 0;
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.value = 700;
  noiseFilter.Q.value = 0.7;
  noise.connect(noiseFilter).connect(noiseGain).connect(master);

  // Re-route the voices through the filter rather than straight to master.
  for (const v of voices) {
    v.gain.disconnect();
    v.gain.connect(filter);
  }
  filter.connect(master);

  const byScene = new Map((comps || []).map((c) => [c.scene.id, c]));
  const started = [];

  return {
    /** Schedule the whole film's score from a playhead position. */
    start(fromMs, whenSec) {
      const at = whenSec == null ? ctx.currentTime + 0.05 : whenSec;
      const ceiling = 0.16 * (opts.level ?? 1);

      for (const v of voices) {
        v.osc.start(at);
        started.push(v.osc);
      }
      noise.start(at);
      started.push(noise);

      // A gentle fade in rather than a switch — a score that begins at
      // full level announces itself.
      master.gain.setValueAtTime(0, at);
      master.gain.linearRampToValueAtTime(ceiling, at + 1.4);

      let actCentre = CENTRES[0];
      let lastAct = null;

      for (const scene of scenes) {
        if (scene.endMs <= fromMs) continue;
        const when = at + Math.max(0, (scene.startMs - fromMs) / 1000);
        const comp = byScene.get(scene.sceneId);
        const state = (comp && comp.state) || {};
        const density = state.visualDensity ?? 0.4;
        const energy = state.motionEnergy ?? 0.4;
        const abstraction = comp ? comp.abstraction : 0.4;
        const restraint = state.restraint ?? 0.5;

        // The act's harmonic centre. Changed on an act boundary only, so
        // it is felt as a section rather than heard as a key change.
        if (scene.actId !== lastAct) {
          lastAct = scene.actId;
          const index = [...new Set(scenes.map((s) => s.actId))].indexOf(scene.actId);
          actCentre = CENTRES[Math.max(0, index) % CENTRES.length];
        }

        // HARMONIC STABILITY FOLLOWS ABSTRACTION. Low on the ladder the
        // voices sit on clean ratios; high up they are pulled apart, and
        // the beating between them is the sound of a film that is no
        // longer describing a thing literally.
        const drift = abstraction * 30;
        voices.forEach((v, i) => {
          v.osc.frequency.setTargetAtTime(actCentre * v.ratio, when, 0.6);
          v.osc.detune.setTargetAtTime((i - 1) * drift, when, 0.8);
        });

        // Density and energy open the filter. Restraint closes it, which
        // is the same ceiling the picture obeys.
        const cutoff = 220 + density * 900 + energy * 500 - restraint * 260;
        filter.frequency.setTargetAtTime(Math.max(120, cutoff), when, 0.7);
        noiseGain.gain.setTargetAtTime(
          Math.max(0, density * 0.05 * (1 - restraint * 0.6)),
          when,
          0.9,
        );

        // DUCK UNDER THE VOICE, and drop further on a contested line. The
        // moment a claim is being reported is not the moment to tell the
        // audience how to feel about it.
        const narrated = Boolean(scene.vo && scene.vo.url);
        const contested = Boolean(comp && comp.scene && comp.scene.reading?.contested);
        const level = ceiling * (narrated ? 0.45 : 1) * (contested ? 0.4 : 1);
        master.gain.setTargetAtTime(level, when, 0.5);
      }
    },

    stop() {
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setTargetAtTime(0, now, 0.25);
      for (const node of started) {
        try {
          node.stop(now + 1.2);
        } catch {
          // Already stopped.
        }
      }
      started.length = 0;
    },
  };
}

/** The score for the film currently on screen, playing through the
 *  speakers. One at a time — two scores is not a richer film. */
const SCORE = { live: null, on: false };

async function playScore(plan, comps, fromMs) {
  const ctx = audioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") await ctx.resume();
  stopScore();
  SCORE.live = buildScore(plan, comps, ctx, ctx.destination, {});
  if (SCORE.live) SCORE.live.start(fromMs);
}

function stopScore() {
  if (SCORE.live) SCORE.live.stop();
  SCORE.live = null;
}

/** A score track for the recorder, alongside the narration's. Same
 *  destination pattern, so the browser muxes one file with both. */
function scoreTrack(plan, comps) {
  const ctx = audioContext();
  if (!ctx) return null;
  const dest = ctx.createMediaStreamDestination();
  const score = buildScore(plan, comps, ctx, dest, {});
  if (!score) return null;
  return {
    track: dest.stream.getAudioTracks()[0] || null,
    begin: () => score.start(0, ctx.currentTime + 0.08),
    stop: () => score.stop(),
  };
}

Object.assign(window, { buildScore, playScore, stopScore, scoreTrack, SCORE });
