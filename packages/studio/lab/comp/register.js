/* REGISTERS — the kinds of page a film can be made of.
 *
 * THE COMPLAINT THIS ANSWERS: "they all look exactly the same… it's just one
 * kind of text colliding… this would last a few seconds before the next
 * thing, which would have to be different."
 *
 * Correct, and it was an architectural gap rather than a tuning one. The
 * engine had exactly ONE way of organising a frame — place type against an
 * occupancy map, lay furniture on it, print it. Varying the seed, the essay
 * and the dials varies parameters INSIDE that one idea, so four films made
 * four ways still read as one film. A magazine is not one page repeated at
 * different densities; it has a cover, a text spread, a data page and a
 * full-bleed opener, in one visual language.
 *
 * WHY THIS IS NOT THE MENU RETURNING. The failure four rebuilds kept
 * producing was `noun → picture`: the sentence names a thing and something
 * draws that thing. Nothing here reads a noun, a subject or a topic. A
 * register is chosen from WHERE YOU ARE IN THE ARGUMENT — the beat's
 * editorial role, whether a section just turned, how long the current
 * register has run — and it sets ORGANISING RULES, never content. The same
 * register on two different essays produces two different pages, because
 * everything inside it is still generated from the writing.
 *
 * The other half of the complaint is handled here too: a register is forced
 * to change. Left alone, one register wins on emphasis for eight beats
 * running, and eight beats of one idea is the thing being complained about.
 */

/** Each register is a set of rules for how a frame is organised. Read the
 *  fields as an art director's instructions, because that is what they are:
 *  how big the headline is, whether there is body copy, how much furniture,
 *  how crowded, and what the paper is doing. */
export const REGISTERS = {
  /** One line, enormous, and almost nothing else. The frame is mostly void
   *  and the void is the point. */
  STATEMENT: {
    keyScale: [0.26, 0.52],
    supportScale: [0.03, 0.05],
    texture: [0, 2],
    bleed: 1,
    marks: { rule: 0.7, bar: 0.25, block: 0.15, screen: 0.12, frame: 0.1 },
    field: { tone: 0.2, turbulence: -0.08, bite: -0.05, coarse: -0.1 },
    crowd: 0.25,
  },
  /** Evidence. Dense small print in columns, ruled, with the promoted phrase
   *  set small enough to belong to the page rather than sit on top of it. */
  DOCUMENT: {
    keyScale: [0.055, 0.095],
    supportScale: [0.026, 0.04],
    texture: [14, 30],
    bleed: 0,
    columns: true,
    marks: { rule: 0.9, bar: 0.15, block: 0.1, screen: 0.35, frame: 0.2 },
    field: { tone: -0.1, turbulence: -0.05, bite: 0, coarse: 0.2 },
    crowd: 1,
  },
  /** Mass against type. Overlap, bleed, hard blocks — the register the engine
   *  had before this file existed, kept because it is genuinely strong and
   *  demoted from being the only one. */
  COLLISION: {
    keyScale: [0.14, 0.34],
    supportScale: [0.04, 0.075],
    texture: [4, 14],
    bleed: 0.8,
    marks: { rule: 0.5, bar: 0.7, block: 0.75, screen: 0.4, frame: 0.15 },
    field: { tone: 0.12, turbulence: 0.1, bite: 0.08, coarse: 0 },
    crowd: 0.9,
  },
  /** Almost nothing. A fragment, the moving field, and room. This is what
   *  makes the register either side of it land, and a film with no empty
   *  frames has no loud ones. */
  VOID: {
    keyScale: [0.05, 0.09],
    supportScale: [0.022, 0.034],
    texture: [0, 1],
    bleed: 0,
    marks: { rule: 0.35, bar: 0.15, block: 0.05, screen: 0.2, frame: 0.05 },
    field: { tone: -0.18, turbulence: -0.1, bite: -0.08, coarse: -0.2 },
    crowd: 0.12,
  },
  /** The page coming apart. Same organisation as COLLISION, but the material
   *  is winning: wear high, bite high, ink failing. Reached late, and only
   *  where the writing is least certain. */
  DECAY: {
    keyScale: [0.16, 0.36],
    supportScale: [0.035, 0.07],
    texture: [6, 18],
    bleed: 0.6,
    marks: { rule: 0.3, bar: 0.5, block: 0.5, screen: 0.55, frame: 0.1 },
    field: { tone: 0.05, turbulence: 0.34, bite: 0.3, coarse: 0.1 },
    crowd: 0.8,
  },
};

const ORDER = ["STATEMENT", "DOCUMENT", "COLLISION", "VOID", "DECAY"];

/** WHAT KIND OF PAGE THIS BEAT IS.
 *
 *  Reads only the beat's editorial position and the film's own history. No
 *  noun, no subject, no topic — the same guarantee the behaviour layer keeps.
 */
export function chooseRegister(beat, prev, runLength, rng, open) {
  const role = beat.editorialRole;
  const vi = beat.visualIntent;

  // The argument's own shape proposes first.
  let want =
    role === "open" || role === "close" || role === "turn"
      ? "STATEMENT"
      : role === "rest"
        ? "VOID"
        : role === "escalate"
          ? "COLLISION"
          : vi.instability > 0.55
            ? "DECAY"
            : vi.density > 0.45
              ? "DOCUMENT"
              : "COLLISION";

  // A REGISTER IS NOT ALLOWED TO OUTSTAY ITS WELCOME. Without this, emphasis
  // alone keeps re-electing the same page and the film becomes one idea held
  // for a minute — which is the complaint, arriving through the mechanism
  // meant to cure it.
  // THE VOCABULARY OPENS ACROSS THE FILM. A film that can reach every
  // register from its first frame is at full range immediately and stays
  // there, which is another way of having no development at all.
  const allowed = open ?? ORDER;
  if (!allowed.includes(want)) want = allowed[allowed.length - 1];

  const cap = want === "VOID" ? 2 : 3;
  if (want === prev && runLength >= cap) {
    const others = allowed.filter((r) => r !== prev && r !== "DECAY");
    if (others.length > 0) want = others[Math.floor(rng() * others.length)];
  }
  return want;
}

/** Blend the register's field bias onto the beat's own field target. The
 *  register says what KIND of paper this page is printed on; the beat still
 *  says how unstable the argument is. */
export function applyField(target, reg) {
  const clamp = (n) => Math.max(0, Math.min(1, n));
  return {
    ...target,
    tone: clamp(target.tone + reg.field.tone),
    turbulence: clamp(target.turbulence + reg.field.turbulence),
    bite: clamp(target.bite + reg.field.bite),
    coarse: clamp(target.coarse + reg.field.coarse),
  };
}

export const lerp = (r, t) => r[0] + (r[1] - r[0]) * t;
