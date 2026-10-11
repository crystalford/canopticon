// Sorting an upload: shape before model (docs/blackbox/README.md §Desk).
//
//   TL;DR / Key findings / numbered sources [n]  → research
//   Abstract + References                        → paper
//   first-person prose, no findings block        → article
//   diagnosis, medication or therapy, in the first person → personal, held private
//
// No model call. The reason is kept with the guess so the Admin card can say
// why a file was read the way it was, and the operator can change it.

export type SortedAs = "research" | "article" | "paper" | "personal";

export const SORT_LABELS: Record<SortedAs, string> = {
  research: "Research",
  article: "Article",
  paper: "Paper",
  personal: "Personal",
};

export function sortUpload(text: string): { as: SortedAs; why: string } {
  const t = text ?? "";
  if (/\b(my|me|I)\b[^.]{0,60}\b(diagnos|medication|therap|my doctor)/i.test(t)) {
    return { as: "personal", why: "names you or your health" };
  }
  if (/^#+\s*abstract\b/im.test(t) && /^#+\s*references\b/im.test(t)) {
    return { as: "paper", why: "has an abstract and a reference list" };
  }
  if (/^#+\s*(tl;?dr|key findings|executive summary)\b/im.test(t) || /\[\d+\]/.test(t)) {
    return { as: "research", why: "has a TL;DR or key findings and numbered sources" };
  }
  if (/\b(I|my)\b/.test(t.slice(0, 2000))) {
    return { as: "article", why: "reads as a first-person argument with no findings block" };
  }
  return { as: "research", why: "looks like a report" };
}

export const isSortedAs = (s: unknown): s is SortedAs =>
  s === "research" || s === "article" || s === "paper" || s === "personal";
