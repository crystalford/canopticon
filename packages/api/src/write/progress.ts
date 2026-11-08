// What a running conversation can say about itself, in true numbers only.
//
// A research report takes about twenty minutes on the research team, and the
// page used to say "Working…" for all of it. The loop knows more: whether the
// report is laid out, how many Details sections are written, how many
// researchers and reviewers are at work, how many notes and pages there are.
// This is that, as one event the page draws as a row of stages and a line of
// counts. No percentage: nothing here knows how much is left, so nothing
// pretends to.

import { sectionsOf, unwritten } from "./notes";

export type Stage = "plan" | "research" | "write" | "review" | "summary";

export const STAGES: Array<{ id: Stage; label: string }> = [
  { id: "plan", label: "Plan" },
  { id: "research", label: "Research" },
  { id: "write", label: "Write" },
  { id: "review", label: "Review" },
  { id: "summary", label: "Summary" },
];

export interface Progress {
  stage: Stage;
  /** Details sections laid out, and written. */
  sections: number;
  written: number;
  researchers: { working: number; done: number };
  reviewers: { working: number; done: number };
  notes: number;
  /** This message's web use. */
  pages: number;
  searches: number;
}

/** What a turn ended with, for the card at the end of the chat. */
export interface TurnSummary {
  words: number;
  sections?: number;
  flags?: number;
  cited?: number;
  independent?: number;
  /** Stopped by Chris, not finished. */
  stopped?: boolean;
  /** Stopped at the per-message spending cap (engines.ts). */
  capped?: boolean;
  /** Ran out of steps. */
  cut?: boolean;
}

/** How far a report's body has come: laid out, sections written, and the
 *  other parts (summary, findings, closing) still to write. */
export function reportState(body: string): {
  outlined: boolean;
  sections: number;
  written: number;
  partsLeft: number;
} {
  const outlined = body.includes("\n## Details");
  if (!outlined) return { outlined, sections: 0, written: 0, partsLeft: 0 };
  const list = sectionsOf(body);
  return {
    outlined,
    sections: list.length,
    written: list.filter((s) => s.text).length,
    partsLeft: unwritten(body).filter((h) => !/^\d+\. /.test(h)).length,
  };
}

/** The stage a report is at, from its body and who is at work. */
export function stageOf(
  body: string,
  team: { researchers: number; reviewers: number },
): { stage: Stage; sections: number; written: number } {
  const r = reportState(body);
  const stage: Stage = team.reviewers
    ? "review"
    : team.researchers
      ? "research"
      : !r.outlined
        ? "plan"
        : r.written < r.sections || !r.sections
          ? "write"
          : "summary";
  return { stage, sections: r.sections, written: r.written };
}

/** Words in a report or article, without its Sources list or headings. */
export function wordCount(body: string): number {
  const end = body.indexOf("\n## Sources");
  return (end < 0 ? body : body.slice(0, end))
    .split("\n")
    .filter((l) => !/^#{1,4} /.test(l) && !/_\(to write\)_/.test(l))
    .join(" ")
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}
