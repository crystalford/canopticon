// THE RULES EDITOR — reading an essay structurally, with no model.
//
// This is NOT a stub. It is what runs in every sandbox without `env.AI`,
// what runs when the model declines, and what runs when the model's answer
// fails verification. Standing rule 8: degrade, flag, continue. It is
// always labelled `source: "rules"` and shown to the operator as "read
// structurally — the model was not available", so it can never be mistaken
// for the model's own reading.
//
// It answers the editorial questions from the text alone: where the
// sections are, which sentences carry weight, where the argument turns,
// which phrases the essay itself returns to. It never says what to draw.

import type { EditorialBeat, EditorialModel, Motif, Phrase, Section } from "../film/schema.ts";
import { type Segmentation, segmentEssay } from "../film/segment.ts";
import { type Located, isStopword, normaliseToken, trimToStrongEdges } from "../text/prose.ts";

/** A sentence that turns the argument announces itself, and these are the
 *  words it uses. Matched at the START of a sentence only — "but" in the
 *  middle of a clause is not a turn. */
const TURN_CUE =
  /^(but|however|yet|and yet|still|instead|except|although|though|in fact|of course|the (problem|trouble|truth) is|what)\b/i;

/** INSTITUTIONAL HEDGING, and the distinction that took a real bug to find.
 *
 *  "presented as", "framed as", "said to be" are the register of an essay
 *  reporting someone else's claim — the argument is holding it at arm's
 *  length, which is genuine uncertainty. Bare "claims" is NOT here, and
 *  deliberately: an essay about asylum *claimants* is not hedging, and the
 *  old extractor marked half such a film uncertain because of it. */
const HEDGE =
  /\b(presented as|framed as|said to be|alleged(?:ly)?|reportedly|apparently|arguably|seem(?:s|ed)? to|appear(?:s|ed)? to|according to|purport(?:s|ed|edly)?|ostensibly|supposedly)\b/i;

/** A quantity the prose actually printed. Checkable by anyone, which is why
 *  it outranks inference everywhere in this codebase. */
const FIGURE =
  /(?:[$£€]\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:million|billion|thousand))?|\b\d[\d,]*(?:\.\d+)?\s?(?:%|per cent|percent)|\b(?:19|20)\d{2}\b|\b\d[\d,]{2,}(?:\.\d+)?\b)/;

/** A run of capitalised words — a name, a title, an institution. */
const PROPER_RUN = /\b(?:[A-Z][\w'’-]*)(?:\s+(?:of|the|and|for|de|van|von)?\s*[A-Z][\w'’-]*)*\b/g;

export function readEssayStructurally(essay: string): EditorialModel {
  const seg = segmentEssay(essay);
  const sections = readSections(essay, seg);
  const motifs = readMotifs(essay, seg);
  const beats = readBeats(essay, seg, sections, motifs);
  return {
    thesis: readThesis(seg),
    register: readRegister(essay),
    sections,
    beats,
    motifs,
    callbacks: readCallbacks(beats),
  };
}

/* ── sections ──────────────────────────────────────────────────────── */

function readSections(essay: string, seg: Segmentation): Section[] {
  const total = essay.length || 1;
  // AN ESSAY WITH NO HEADINGS IS NOT ONE SECTION.
  //
  // Grouping every paragraph of an unheaded essay into a single block gives
  // the film one flat section, which means no section boundary ever fires
  // and `interrupt` never happens — the argument's own shape disappears.
  // Where the author wrote no headings, their PARAGRAPHS are the sections.
  const units: { startChar: number; endChar: number; first: string }[] = seg.blocks.some(
    (b) => b.heading,
  )
    ? seg.blocks.map((b) => ({
        startChar: b.startChar,
        endChar: b.endChar,
        first: b.paragraphs[0]?.text ?? b.heading ?? "",
      }))
    : seg.blocks
        .flatMap((b) => b.paragraphs)
        .map((p) => ({ startChar: p.startChar, endChar: p.endChar, first: p.text }));

  return units.map((block, i) => {
    const at = block.startChar / total;
    const first = block.first;
    const isLast = i === units.length - 1;
    const fn: Section["function"] =
      at <= 0.15 && i === 0
        ? "hook"
        : isLast || at >= 0.85
          ? "resolution"
          : TURN_CUE.test(first)
            ? "turn"
            : i === 1
              ? "premise"
              : "evidence";
    const text = essay.slice(block.startChar, block.endChar);
    return {
      id: `s${i + 1}`,
      range: { startChar: block.startChar, endChar: block.endChar },
      function: fn,
      // A section reads louder when it is short and declarative, and when
      // it sits late in the essay.
      intensity: clamp01(0.3 + at * 0.4 + (fn === "turn" || fn === "resolution" ? 0.2 : 0)),
      certainty: HEDGE.test(text) ? 0.35 : 0.75,
    };
  });
}

/* ── beats ─────────────────────────────────────────────────────────── */

interface Scored extends Located {
  words: number;
  sectionId: string;
  emphasis: number;
  certainty: number;
  isTurn: boolean;
  paraFinal: boolean;
}

function readBeats(
  essay: string,
  seg: Segmentation,
  sections: Section[],
  motifs: Motif[],
): EditorialBeat[] {
  const scored = scoreSentences(essay, seg, sections);
  if (scored.length === 0) return [];

  // GROUP, so five short sentences are two or three beats and not five.
  // A beat is a unit of attention, not a unit of grammar — this is the
  // single most important difference from the old scene-per-sentence model.
  const groups: Scored[][] = [];
  let run: Scored[] = [];
  for (const s of scored) {
    const breaks =
      run.length > 0 &&
      (run[0]?.sectionId !== s.sectionId ||
        s.isTurn ||
        s.emphasis > 0.72 ||
        run[run.length - 1]?.paraFinal === true ||
        run.reduce((n, x) => n + x.words, 0) + s.words > 34);
    if (breaks) {
      groups.push(run);
      run = [];
    }
    run.push(s);
  }
  if (run.length > 0) groups.push(run);

  const motifByPhrase = new Map(motifs.map((m) => [m.phrase.toLowerCase(), m]));
  const emphases = groups.map((g) => Math.max(...g.map((s) => s.emphasis)));
  const sorted = [...emphases].sort((a, b) => b - a);
  // ~30% of beats carry any text at all. Most narration stays unseen.
  const phraseGate = sorted[Math.floor(sorted.length * 0.12)] ?? 1;
  const wordGate = sorted[Math.floor(sorted.length * 0.32)] ?? 1;

  return groups.map((group, i) => {
    const head = group[0] as Scored;
    const emphasis = emphases[i] as number;
    const certainty = Math.min(...group.map((s) => s.certainty));
    const prev = groups[i - 1];
    const text = group.map((s) => s.text).join(" ");

    const role: EditorialBeat["role"] =
      i === 0
        ? "open"
        : i === groups.length - 1
          ? "close"
          : head.isTurn
            ? "turn"
            : emphasis > 0.75
              ? "escalate"
              : emphasis < 0.3
                ? "rest"
                : prev && prev[0]?.sectionId !== head.sectionId
                  ? "assert"
                  : "develop";

    const continuity: EditorialBeat["continuity"] =
      prev && prev[0]?.sectionId !== head.sectionId
        ? "interrupt"
        : role === "rest"
          ? "rest"
          : role === "turn" || role === "escalate"
            ? "transform"
            : "continue";

    const phrases = choosePhrases(essay, group, motifByPhrase);
    const promotion: EditorialBeat["promotion"] =
      phrases.length === 0
        ? "none"
        : emphasis >= phraseGate
          ? phrases.length > 1
            ? "fragments"
            : "phrase"
          : emphasis >= wordGate
            ? "word"
            : "none";

    const motif = phrases.find((p) => p.motifId);
    const beat: EditorialBeat = {
      id: `b${i + 1}`,
      sectionId: head.sectionId,
      range: {
        startChar: head.startChar,
        endChar: (group[group.length - 1] as Scored).endChar,
      },
      role,
      emphasis,
      certainty,
      continuity,
      promotion: promotion === "none" ? "none" : promotion,
      phrases: promotion === "none" ? [] : phrases,
    };
    if (motif?.motifId) {
      const m = motifs.find((x) => x.id === motif.motifId);
      const seen = m ? m.occurrences.filter((o) => o < head.startChar).length : 0;
      beat.motifRef = {
        motifId: motif.motifId,
        treatment:
          seen === 0
            ? "establish"
            : m?.arc === "degrade"
              ? "degrade"
              : role === "close"
                ? "restate"
                : "repeat",
      };
    }
    void text;
    return beat;
  });
}

function scoreSentences(essay: string, seg: Segmentation, sections: Section[]): Scored[] {
  const paraEnds = new Set(seg.blocks.flatMap((b) => b.paragraphs.map((p) => p.endChar)));
  const lengths = seg.sentences.map((s) => s.text.split(/\s+/).length);
  const median = lengths.length > 0 ? [...lengths].sort((a, b) => a - b)[lengths.length >> 1] : 20;

  const raw = seg.sentences.map((s, i) => {
    const words = lengths[i] as number;
    const section =
      sections.find(
        (sec) => s.startChar >= sec.range.startChar && s.startChar < sec.range.endChar,
      ) ?? sections[0];
    const isTurn = TURN_CUE.test(s.text);
    const paraFinal = paraEnds.has(s.endChar);
    // A six-word declarative among thirty-word sentences is the loudest
    // thing on the page, and it is measurable.
    const shortness = clamp01(((median as number) - words) / Math.max(6, median as number));
    const score =
      shortness * 0.4 +
      (paraFinal ? 0.18 : 0) +
      (FIGURE.test(s.text) ? 0.16 : 0) +
      (isTurn ? 0.22 : 0) +
      (section?.intensity ?? 0.5) * 0.2;
    return {
      ...s,
      words,
      sectionId: section?.id ?? "s1",
      emphasis: score,
      certainty: HEDGE.test(s.text) ? 0.3 : (section?.certainty ?? 0.7),
      isTurn,
      paraFinal,
    };
  });

  // Normalise across the film so emphasis means "loud for THIS essay".
  const max = Math.max(...raw.map((r) => r.emphasis), 0.001);
  const min = Math.min(...raw.map((r) => r.emphasis));
  void essay;
  return raw.map((r) => ({
    ...r,
    emphasis: clamp01(max === min ? 0.5 : (r.emphasis - min) / (max - min)),
  }));
}

/** What the essay's own words are, when this beat gets to speak on screen.
 *
 *  Never invented, never paraphrased, always trimmed so it cannot begin or
 *  end on a function word. Preference order: a phrase the film is already
 *  carrying as a motif, then a printed figure, then a name, then the
 *  sentence's first strong clause. */
function choosePhrases(essay: string, group: Scored[], motifs: Map<string, Motif>): Phrase[] {
  const best = [...group].sort((a, b) => b.emphasis - a.emphasis)[0] as Scored;
  const out: Phrase[] = [];

  for (const [phrase, motif] of motifs) {
    const at = best.text.toLowerCase().indexOf(phrase);
    if (at >= 0) {
      out.push({
        text: essay.slice(best.startChar + at, best.startChar + at + phrase.length),
        offset: best.startChar + at,
        weight: 1,
        motifId: motif.id,
      });
      break;
    }
  }

  if (out.length === 0) {
    const fig = best.text.match(FIGURE);
    if (fig?.index !== undefined) {
      out.push({
        text: fig[0],
        offset: best.startChar + fig.index,
        weight: 0.9,
      });
    }
  }

  if (out.length === 0) {
    const runs = [...best.text.matchAll(PROPER_RUN)]
      // Skip a capital that is only there because it opens the sentence.
      .filter((m) => (m.index ?? 0) > 0 || m[0].split(/\s+/).length > 1)
      .sort((a, b) => b[0].length - a[0].length);
    const run = runs[0];
    if (run?.index !== undefined && run[0].length >= 4) {
      out.push({ text: run[0], offset: best.startChar + run.index, weight: 0.8 });
    }
  }

  if (out.length === 0) {
    const clause = best.text.split(/[,;:—]/)[0] ?? best.text;
    const trimmed = trimToStrongEdges(clause);
    const at = best.text.indexOf(trimmed);
    const wordCount = trimmed.split(/\s+/).length;
    if (trimmed.length >= 4 && wordCount <= 7 && at >= 0) {
      out.push({ text: trimmed, offset: best.startChar + at, weight: 0.6 });
    }
  }

  // Verify our own work by the same rule the model's answer is held to.
  return out.filter((p) => essay.slice(p.offset, p.offset + p.text.length) === p.text);
}

/* ── motifs ────────────────────────────────────────────────────────── */

/** Phrases the essay itself returns to. If it returns to nothing, there
 *  are no motifs — the film does not get to invent a refrain. */
function readMotifs(essay: string, seg: Segmentation): Motif[] {
  const counts = new Map<string, { display: string; offsets: number[] }>();

  for (const sentence of seg.sentences) {
    const words = [...sentence.text.matchAll(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)];
    for (let n = 2; n <= 4; n++) {
      for (let i = 0; i + n <= words.length; i++) {
        const span = words.slice(i, i + n);
        const first = span[0] as RegExpMatchArray;
        const last = span[n - 1] as RegExpMatchArray;
        if (isStopword(first[0]) || isStopword(last[0])) continue;
        const startInSentence = first.index ?? 0;
        const endInSentence = (last.index ?? 0) + last[0].length;
        const display = sentence.text.slice(startInSentence, endInSentence);
        const key = span.map((w) => normaliseToken(w[0])).join(" ");
        if (key.length < 6) continue;
        const entry = counts.get(key) ?? { display, offsets: [] };
        entry.offsets.push(sentence.startChar + startInSentence);
        counts.set(key, entry);
      }
    }
  }

  return (
    [...counts.entries()]
      .filter(([, v]) => v.offsets.length >= 2)
      // Longer and more frequent wins. A two-word phrase said twice is
      // weaker than a four-word phrase said three times.
      .sort((a, b) => b[1].offsets.length * b[0].length - a[1].offsets.length * a[0].length)
      .slice(0, 3)
      .map(([, v], i) => {
        // CASE VARIES ACROSS OCCURRENCES AND THAT IS NOT A MISMATCH.
        //
        // "Gimmick Economy" in the title and "the gimmick economy" in the
        // body are the same motif — the essay returning to its own phrase.
        // Verifying every occurrence against the FIRST one's capitalisation
        // threw away the recurrence and left the film with no motifs at all.
        // Each occurrence keeps its own verbatim text; the motif is named by
        // the longest one, which is usually the fullest form.
        const kept = v.offsets.filter(
          (o) => essay.slice(o, o + v.display.length).toLowerCase() === v.display.toLowerCase(),
        );
        const named =
          kept
            .map((o) => essay.slice(o, o + v.display.length))
            .sort((a, b) => b.length - a.length)[0] ?? v.display;
        return {
          id: `m${i + 1}`,
          phrase: named,
          occurrences: kept,
          arc: (i === 0 ? "escalate" : "survive") as Motif["arc"],
        };
      })
      .filter((m) => m.occurrences.length >= 2)
  );
}

/* ── the rest ──────────────────────────────────────────────────────── */

function readThesis(seg: Segmentation): string {
  // The last sentence of the first paragraph is the thesis more often than
  // any other single position in an essay.
  const firstPara = seg.blocks[0]?.paragraphs[0];
  if (!firstPara) return seg.sentences[0]?.text ?? "";
  const inPara = seg.sentences.filter(
    (s) => s.startChar >= firstPara.startChar && s.endChar <= firstPara.endChar,
  );
  return inPara[inPara.length - 1]?.text ?? inPara[0]?.text ?? "";
}

function readRegister(essay: string): EditorialModel["register"] {
  if (/\bI\b|\bmy\b|\bme\b/.test(essay)) return "confessional";
  if (/\bshould\b|\bmust\b|\boutrage|\bwrong\b/i.test(essay)) return "polemic";
  if (FIGURE.test(essay) && /\baccording to\b|\breported\b/i.test(essay)) return "reportorial";
  return "analytic";
}

function readCallbacks(beats: EditorialBeat[]): EditorialModel["callbacks"] {
  const out: EditorialModel["callbacks"] = [];
  const byMotif = new Map<string, string[]>();
  for (const b of beats) {
    if (!b.motifRef) continue;
    const list = byMotif.get(b.motifRef.motifId) ?? [];
    list.push(b.id);
    byMotif.set(b.motifRef.motifId, list);
  }
  for (const ids of byMotif.values()) {
    for (let i = 1; i < ids.length; i++) {
      out.push({
        fromBeatId: ids[i - 1] as string,
        toBeatId: ids[i] as string,
        kind: i === ids.length - 1 ? "restate" : "answer",
      });
    }
  }
  return out;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
