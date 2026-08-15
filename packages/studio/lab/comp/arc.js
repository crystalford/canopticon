/* THE ARC — the film's own development, across its whole length.
 *
 * THE COMPLAINT THIS ANSWERS: "that looks like one frame out of a full
 * video." Exactly right, and the reason was that every moment was drawn from
 * the SAME DISTRIBUTION. Register, transition, behaviour and seed all varied
 * per beat, but they varied around a fixed centre, so minute three could be
 * swapped with minute one and nothing would be wrong. A film whose moments
 * are interchangeable is a style, not a film.
 *
 * A real sequence has somewhere it starts and somewhere it ends up. So a
 * small number of curves run the LENGTH of the film and bias everything
 * else: how large type can be, how crowded the page gets, how fast it cuts,
 * how far gone the material is. The per-beat decisions still happen — they
 * now happen around a centre that is itself travelling.
 *
 * Nothing here is random and nothing here reads the writing's content. These
 * are functions of POSITION IN THE FILM, so the same essay always develops
 * the same way, and two essays of different lengths develop at their own
 * pace rather than at a fixed number of seconds.
 */

const clamp01 = (n) => Math.max(0, Math.min(1, n));

/** A rising-then-falling curve with its peak off-centre. Symmetrical arcs
 *  read as mechanical; a late peak reads as an argument building. */
const swell = (u, peak) =>
  u < peak ? Math.pow(u / peak, 0.85) : Math.pow(1 - (u - peak) / (1 - peak), 1.5);

/** Where the film is, and what that means for everything else.
 *
 *  `u` is 0 at the first frame and 1 at the last.
 */
export function arcAt(u) {
  const t = clamp01(u);
  return {
    /** SCALE — a U, not a swell.
     *
     *  Large and declarative at the open, small through the body of the
     *  argument where the evidence is, large again for the close. The first
     *  version subtracted a term that rose with t, which made the END of the
     *  film its quietest point — an ending that cannot raise its voice. */
    scale: 1 - swell(t, 0.5) * 0.58,

    /** DENSITY. Builds. The page accumulates evidence as the argument does,
     *  which is the one movement almost every essay actually makes. */
    density: 0.25 + Math.pow(t, 0.8) * 0.85,

    /** EVENT RATE. Slow to start, quickest through the middle, holding at
     *  the end — the shape of nearly every edited sequence. */
    rate: 0.45 + swell(t, 0.62) * 0.75,

    /** MATERIAL. Only ever worsens. A photocopy of a photocopy: the last
     *  minute cannot look like the first, and this is the term that
     *  guarantees it however the beats fall. */
    wear: Math.pow(t, 1.25),

    /** CONTRAST. The ink gets harder as the film goes on. */
    bite: 0.15 + t * 0.5,

    /** HOW WILLING THE FILM IS TO TRANSFORM rather than replace. Low at the
     *  start, where things are being introduced and nothing has a past to
     *  come from; high later, where everything on screen came from
     *  something. */
    morph: clamp01(t * 1.6 - 0.15),
  };
}

/** Which registers the film will even consider at this point.
 *
 *  A film that can reach its whole vocabulary from the first frame has no
 *  development — it is at full range immediately and stays there. The
 *  vocabulary OPENS: it begins able to state and to rest, earns density in
 *  the middle, and only falls apart once there is something built to fall
 *  apart.
 */
export function vocabularyAt(u) {
  const t = clamp01(u);
  const open = ["STATEMENT", "VOID"];
  if (t > 0.12) open.push("COLLISION");
  if (t > 0.2) open.push("DOCUMENT");
  if (t > 0.55) open.push("DECAY");
  return open;
}
