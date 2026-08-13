/* CANOPTICON — the built-in example.
 *
 * This was the app: one essay compiled into the page, and every view read
 * it. It is now what it should always have been — an EXAMPLE, so the
 * instrument opens on something rather than on an empty room, and so the
 * palette can be explored with nothing stored.
 *
 * A real project replaces `window.FILM` wholesale (see bridge.js). Nothing
 * here is consulted once one is loaded.
 */
const ESSAY = `In March of 2003, the legislature passed what everyone involved described as a temporary measure. The statute ran to eleven pages. It granted the department emergency authority to bypass its own review process, and it was written to expire in ninety days.

It has been renewed forty-one times.

Nobody has ever voted against a renewal. The renewals are not debated; they are attached to appropriations bills as a single line, and the line has not changed since 2006. The department's own compliance office has referred to the authority as "standing" in internal documents since at least 2011, which is to say that eight years into a ninety-day measure, the people operating under it had stopped treating it as an exception.

What makes this ordinary rather than scandalous is the paperwork. Every renewal was lawful. Every signature was authorized. There is no memo in which someone decides to make the temporary permanent, because no such decision was ever required. Permanence was the default condition of a thing nobody had a procedure for ending.

The department now cites the measure as settled law. In a 2021 filing, its counsel described the authority as "longstanding" — a word that does real work here. Longstanding is not a legal category. It is a claim about time, and time is the only thing the measure has actually accumulated.

I want to be careful about what this is evidence of. It is not evidence of conspiracy. It is evidence of something more difficult to photograph: an institution that continued, and in continuing, became the rule it was written to suspend.`;

function find(t) {
  const i = ESSAY.indexOf(t);
  return { startChar: i, endChar: i + t.length };
}

/** The creative vocabulary, named once.
 *
 *  This lived inside the example's own object, so a real film loaded from
 *  the compiler had no lane labels and the Editorial view threw on the
 *  first one it looked for. The vocabulary is the DESIGN's and is shared
 *  by every film — see bridge.js, which hands it to real projects. */
const PARAMS = [
    { id: "abstraction", name: "ABSTRACTION", lo: "LITERAL", hi: "ABSTRACT", arc: 1 },
    { id: "archivalWeight", name: "ARCHIVAL", lo: "NONE", hi: "DOMINANT", arc: 1 },
    { id: "dataWeight", name: "DATA", lo: "NONE", hi: "DOMINANT", arc: 1 },
    { id: "visualDensity", name: "DENSITY", lo: "SPARSE", hi: "DENSE", arc: 1 },
    { id: "humanPresence", name: "HUMAN PRESENCE", lo: "ABSENT", hi: "PRESENT", arc: 1 },
    { id: "motionEnergy", name: "MOTION ENERGY", lo: "CALM", hi: "FRENETIC", arc: 1 },
    { id: "typographicWeight", name: "TYPOGRAPHY", lo: "QUIET", hi: "LOUD" },
    { id: "experimentalism", name: "EXPERIMENTALISM", lo: "RESTRAINED", hi: "EXPERIMENTAL" },
    { id: "restraint", name: "RESTRAINT", lo: "MAXIMAL", hi: "SPARE" },
  ];
window.PARAMS = PARAMS;

const FILM = {
  projectId: "proj_004",
  title: "The Temporary Measure",
  irVersion: "0.1.0",
  logline:
    "An emergency order written for ninety days, renewed forty-one times, now cited as settled law.",
  essay: ESSAY,
  acts: [
    { actId: "act_1", title: "The Measure", span: [0, 0.3] },
    { actId: "act_2", title: "The Accumulation", span: [0.3, 0.745] },
    { actId: "act_3", title: "What It Became", span: [0.745, 1] },
  ],
  scenes: [
    {
      id: "s01",
      act: "act_1",
      fn: "hook",
      label: "A temporary measure",
      text: "In March of 2003, the legislature passed what everyone involved described as a temporary measure.",
      dur: 7.4,
      entities: ["time", "institution"],
    },
    {
      id: "s02",
      act: "act_1",
      fn: "establish",
      label: "Eleven pages",
      text: "The statute ran to eleven pages.",
      dur: 3.1,
      entities: ["institution"],
    },
    {
      id: "s03",
      act: "act_1",
      fn: "evidence",
      label: "Ninety days",
      text: "It granted the department emergency authority to bypass its own review process, and it was written to expire in ninety days.",
      dur: 9.2,
      entities: ["institution", "time"],
    },
    {
      id: "s04",
      act: "act_1",
      fn: "turn",
      label: "Forty-one times",
      text: "It has been renewed forty-one times.",
      dur: 4.0,
      entities: ["time"],
    },
    {
      id: "s05",
      act: "act_2",
      fn: "evidence",
      label: "Nobody voted against",
      text: "Nobody has ever voted against a renewal.",
      dur: 3.6,
      entities: ["institution"],
    },
    {
      id: "s06",
      act: "act_2",
      fn: "evidence",
      label: "A single line",
      text: "The renewals are not debated; they are attached to appropriations bills as a single line, and the line has not changed since 2006.",
      dur: 10.4,
      entities: ["institution", "time"],
    },
    {
      id: "s07",
      act: "act_2",
      fn: "evidence",
      label: '"Standing"',
      text: 'The department\u2019s own compliance office has referred to the authority as "standing" in internal documents since at least 2011, which is to say that eight years into a ninety-day measure, the people operating under it had stopped treating it as an exception.',
      dur: 17.8,
      entities: ["institution", "uncertainty"],
    },
    {
      id: "s08",
      act: "act_2",
      fn: "turn",
      label: "The paperwork",
      text: "What makes this ordinary rather than scandalous is the paperwork.",
      dur: 4.8,
      entities: ["institution"],
    },
    {
      id: "s09",
      act: "act_2",
      fn: "evidence",
      label: "Every signature",
      text: "Every renewal was lawful. Every signature was authorized.",
      dur: 5.2,
      entities: ["institution"],
    },
    {
      id: "s10",
      act: "act_2",
      fn: "turn",
      label: "No such decision",
      text: "There is no memo in which someone decides to make the temporary permanent, because no such decision was ever required.",
      dur: 9.6,
      entities: ["uncertainty"],
    },
    {
      id: "s11",
      act: "act_2",
      fn: "resolve",
      label: "The default condition",
      text: "Permanence was the default condition of a thing nobody had a procedure for ending.",
      dur: 6.8,
      entities: ["time", "uncertainty"],
    },
    {
      id: "s12",
      act: "act_3",
      fn: "evidence",
      label: "Settled law",
      text: "The department now cites the measure as settled law.",
      dur: 4.2,
      entities: ["institution"],
    },
    {
      id: "s13",
      act: "act_3",
      fn: "evidence",
      label: '"Longstanding"',
      text: 'In a 2021 filing, its counsel described the authority as "longstanding" \u2014 a word that does real work here.',
      dur: 8.4,
      entities: ["institution", "time"],
    },
    {
      id: "s14",
      act: "act_3",
      fn: "turn",
      label: "A claim about time",
      text: "Longstanding is not a legal category. It is a claim about time, and time is the only thing the measure has actually accumulated.",
      dur: 10.6,
      entities: ["time", "uncertainty"],
    },
    {
      id: "s15",
      act: "act_3",
      fn: "resolve",
      label: "Not conspiracy",
      text: "I want to be careful about what this is evidence of. It is not evidence of conspiracy.",
      dur: 6.4,
      entities: ["uncertainty"],
    },
    {
      id: "s16",
      act: "act_3",
      fn: "resolve",
      label: "Became the rule",
      text: "It is evidence of something more difficult to photograph: an institution that continued, and in continuing, became the rule it was written to suspend.",
      dur: 12.0,
      entities: ["institution", "time"],
    },
  ],
  params: PARAMS,

  identity: { typographicWeight: 0.63, experimentalism: 0.31, restraint: 0.42, cutRhythm: 0.4 },
  controlPoints: [
    {
      at: 0,
      v: {
        abstraction: 0.15,
        archivalWeight: 0.7,
        dataWeight: 0.12,
        visualDensity: 0.35,
        humanPresence: 0.8,
        motionEnergy: 0.2,
      },
    },
    {
      at: 0.16,
      v: {
        abstraction: 0.18,
        archivalWeight: 0.62,
        dataWeight: 0.2,
        visualDensity: 0.42,
        humanPresence: 0.72,
        motionEnergy: 0.3,
      },
    },
    {
      at: 0.33,
      v: {
        abstraction: 0.25,
        archivalWeight: 0.45,
        dataWeight: 0.44,
        visualDensity: 0.6,
        humanPresence: 0.55,
        motionEnergy: 0.48,
      },
    },
    {
      at: 0.5,
      v: {
        abstraction: 0.34,
        archivalWeight: 0.34,
        dataWeight: 0.58,
        visualDensity: 0.72,
        humanPresence: 0.38,
        motionEnergy: 0.6,
      },
    },
    {
      at: 0.68,
      v: {
        abstraction: 0.48,
        archivalWeight: 0.25,
        dataWeight: 0.55,
        visualDensity: 0.85,
        humanPresence: 0.32,
        motionEnergy: 0.72,
      },
    },
    {
      at: 0.85,
      v: {
        abstraction: 0.68,
        archivalWeight: 0.18,
        dataWeight: 0.44,
        visualDensity: 0.62,
        humanPresence: 0.52,
        motionEnergy: 0.8,
      },
    },
    {
      at: 1,
      v: {
        abstraction: 0.85,
        archivalWeight: 0.1,
        dataWeight: 0.3,
        visualDensity: 0.3,
        humanPresence: 0.7,
        motionEnergy: 0.88,
      },
    },
  ],
  invariants: [
    { param: "humanPresence", min: 0.3 },
    { param: "visualDensity", max: 0.92 },
  ],
  motifs: [
    {
      id: "time",
      concept: "TIME",
      chain: "timeline_linear + text_stagger",
      established: "s01",
      states: ["flat", "layered", "fragmented", "dissolved"],
      rule: "escalate_with_abstraction",
    },
    {
      id: "institution",
      concept: "INSTITUTION",
      chain: "document_surface + camera_move",
      established: "s02",
      states: ["clean", "aged", "redacted", "erased"],
      rule: "escalate_with_abstraction",
    },
    {
      id: "uncertainty",
      concept: "UNCERTAINTY",
      chain: "glyph_to_points + particle_flow",
      established: "s07",
      states: ["stable", "drifting", "scattered", "dispersed"],
      rule: "escalate_with_abstraction",
    },
  ],
  rules: [
    {
      id: "r1",
      severity: "hard",
      text: "No abstract visuals before Act II",
      scope: "act_1",
      kind: "forbid_vocabulary",
    },
    {
      id: "r2",
      severity: "hard",
      text: "Return to the TIME motif on every backward jump",
      kind: "require_motif",
    },
    {
      id: "r3",
      severity: "soft",
      text: "Minimum 2s breathing room after any high-density passage",
      kind: "breathing_room",
    },
    {
      id: "r4",
      severity: "soft",
      text: "Never abstract a scene tagged EVIDENCE above 0.60",
      kind: "narrative_guard",
    },
  ],
  overrides: [
    { sceneId: "s09", type: "pin", note: "Held: document surface, no motion. Set 12 Aug." },
  ],
};

FILM.scenes.forEach((s, i) => {
  s.n = i + 1;
  s.src = find(s.text.split(". ")[0].replace(/\u2019/g, "\u2019"));
});
(() => {
  let t = 0;
  const total = FILM.scenes.reduce((a, s) => a + s.dur, 0);
  FILM.runtime = total;
  FILM.scenes.forEach((s) => {
    s.t0 = t;
    t += s.dur;
    s.t1 = t;
    s.pos = (s.t0 + s.t1) / 2 / total;
  });
})();

// The example, under its own name. `window.FILM` is whatever is currently
// on screen — the example at first load, a real project after that.
window.DEMO_FILM = FILM;
window.FILM = FILM;
