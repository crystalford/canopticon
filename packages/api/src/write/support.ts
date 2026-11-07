// The support check: is each cited sentence of a research report stated by
// the notes it cites?
//
// Code already proves every quotation is on a page read and every citation
// names a listed source. It cannot read meaning. The reviewers can, but they
// check what they happen to notice. This asks Cloudflare's Clef decision
// model — a calibrated yes/no model on the regular Workers AI bill, about
// $0.04 per million input tokens for clef-flash — one question per cited
// sentence: do the passages under its source numbers state what it says?
// The answer is a probability, not a verdict.
//
// Advisory until checked against hand-marked sentences: only a sentence the
// checker is nearly sure is unsupported is handed to the writer; every
// probability is reported for measurement.

import type { Env } from "../env";
import { type Note, sectionsOf, sourceNumbers } from "./notes";

/** Below this, a sentence goes to the writer as probably unsupported. */
export const UNSUPPORTED_BELOW = 0.2;
const PER_CALL = 48;
const FLASH_CHARS = 60_000; // clef-flash reads ~24k tokens; clef ~65k.

export interface Cited {
  section: number;
  sentence: string;
  cites: number[];
}

export interface Support extends Cited {
  /** The checker's probability that the cited passages state it. */
  p: number;
}

/** Every sentence in the Details sections that cites a source. */
export function citedSentences(body: string): Cited[] {
  const out: Cited[] = [];
  for (const s of sectionsOf(body)) {
    const text = s.text.replace(/^#{2,4} [^\n]*$/gm, " ");
    for (const raw of text.split(/(?<=[.!?](?:\s*\[\d+(?:[,\s–-]*\d+)*\])*)\s+(?=[A-Z“"(])/)) {
      const sentence = raw.replace(/\s+/g, " ").trim();
      const cites = [...sentence.matchAll(/\[(\d+(?:[,\s–-]*\d+)*)\]/g)].flatMap(
        (m) => (m[1] ?? "").match(/\d+/g)?.map(Number) ?? [],
      );
      if (cites.length && sentence.length >= 30)
        out.push({ section: s.n, sentence, cites: [...new Set(cites)] });
    }
  }
  return out;
}

type Run = (model: string, input: unknown) => Promise<unknown>;

/** A probability from Clef's answer for one question, however it is shaped. */
export function probability(answer: unknown): number | null {
  if (typeof answer === "number") return answer;
  if (answer && typeof answer === "object") {
    const a = answer as Record<string, unknown>;
    // Live (2026-11-07): {"type": "noul", "noul": 0.6915}.
    for (const k of ["noul", "probability", "p", "yes", "true", "value", "score"])
      if (typeof a[k] === "number") return a[k] as number;
  }
  return null;
}

/** Ask the checker about every cited sentence, a section at a time. */
export async function supportCheck(env: Env, body: string, notes: Note[]): Promise<Support[]> {
  const run = (env.AI as unknown as { run: Run }).run.bind(env.AI);
  const numbers = sourceNumbers(notes);
  const passages = new Map<number, string[]>();
  for (const n of notes) {
    const k = numbers.get(n.url);
    if (k) passages.set(k, [...(passages.get(k) ?? []), n.quote]);
  }
  const all = citedSentences(body);
  const out: Support[] = [];
  const bySection = new Map<number, Cited[]>();
  for (const c of all) bySection.set(c.section, [...(bySection.get(c.section) ?? []), c]);
  for (const list of bySection.values()) {
    for (let i = 0; i < list.length; i += PER_CALL) {
      const part = list.slice(i, i + PER_CALL);
      const sources = [...new Set(part.flatMap((c) => c.cites))].sort((a, b) => a - b);
      const evidence = Object.fromEntries(
        sources.map((k) => [`[${k}]`, passages.get(k) ?? ["(no passage noted from this source)"]]),
      );
      const sentences = Object.fromEntries(part.map((c, j) => [`s${j + 1}`, c.sentence]));
      const state = JSON.stringify({ evidence, sentences });
      const questions = Object.fromEntries(
        part.map((c, j) => [
          `s${j + 1}`,
          {
            type: "noul",
            instructions: `Is everything sentence s${j + 1} asserts stated or directly implied by the evidence passages under the source numbers it cites (${c.cites.map((k) => `[${k}]`).join(" ")})? No if it adds a figure, date, cause, scope or certainty those passages do not give.`,
          },
        ]),
      );
      const big = state.length > FLASH_CHARS;
      const r = (await run(big ? "@cf/cloudflare/clef" : "@cf/cloudflare/clef-flash", {
        model: big ? "clef" : "clef-flash",
        state,
        questions,
      }).catch(() => null)) as { answers?: Record<string, unknown> } | null;
      part.forEach((c, j) => {
        const p = probability(r?.answers?.[`s${j + 1}`]);
        if (p !== null) out.push({ ...c, p });
      });
    }
  }
  return out;
}
