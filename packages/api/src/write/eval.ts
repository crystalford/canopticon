// The engine test: one fixed set of tasks, one quality bar, scored in code.
//
// Which model runs the workspace is decided here, not by impression: every
// candidate is given the same tasks (/v1/admin/engine-try?eval=N, run by the
// "Engine test" workflow), each result is graded against the bar below, and
// the default is the cheapest engine that passes every task. When Cloudflare
// adds a model, add it to TRIAL_ENGINES and run the workflow; it is offered
// only if it passes.
//
// The bar is the record's own standard (CLAUDE.md, "Research"): a document of
// record at the record's depth, every quotation word for word in a page read,
// every citation a listed source. Figures not found in any page read are
// counted but allowed a few (a page may say "$1,900 million" for "$1.9
// billion", and a sum is the writer's own) — the number is reported so the
// bar can be tightened when it is understood.

export type EvalKind = "research" | "article";

export interface EvalTask {
  kind: EvalKind;
  /** What it tests, in a few words. */
  label: string;
  /** The first message, as Chris would send it. */
  text: string;
}

export const EVAL_SET: EvalTask[] = [
  {
    kind: "research",
    label: "policy, numbers",
    text: "What has Canada's national pharmacare program actually delivered since the Pharmacare Act passed in 2024: which provinces and territories have signed agreements, what is covered, how many people are using it, and what do the Parliamentary Budget Officer and other independent estimates say the full program would cost?",
  },
  {
    kind: "research",
    label: "evidence, studies",
    text: "What does the evidence say about school smartphone bans: which jurisdictions (Ontario, England, the Netherlands, Australian states and others) have adopted them, what have evaluations measured about learning, attention, bullying and mental health, and how strong is that evidence?",
  },
  {
    kind: "research",
    label: "ideas, scholarship",
    text: "What did Marshall McLuhan's laws of media (the tetrad) actually claim, how have scholars applied, extended or criticised it since Laws of Media appeared in 1988, and has anyone tried to test it empirically?",
  },
  {
    kind: "article",
    label: "article from the record",
    // Not Airbnb bans: two articles on them are already published, and V4 Pro
    // rightly declined to write a third (engine test, 2026-11-07).
    text: "Write an article from the record's research on algorithmic rent-setting software in Canada: what it does, what the record found about its use and its effects on rents, and what remains unproven. Argue from what the documents show, quoting them.",
  },
];

/** The bar. Research: the record's median is ~4,500 words; 3,000 is the
 *  floor for a full-depth answer. Articles: the record's run 1,000–2,500
 *  words with ~18 quotations. */
export const BAR = {
  research: { words: 3000, quotations: 10, pages: 10, figuresNotInPages: 8 },
  article: { words: 1200, quotations: 8 },
};

export interface EvalResult {
  kind: EvalKind;
  finished: boolean;
  words: number;
  quotations: number;
  notFound: number;
  unwritten?: boolean;
  citations?: number;
  figuresNotInPages?: number;
  pages?: number;
  /** Article: what Publish would refuse for (topic, quotes, closed sources). */
  publishProblems?: string[];
}

/** Whether a result meets the bar, and every way it falls short. */
export function grade(r: EvalResult): { pass: boolean; misses: string[] } {
  const m: string[] = [];
  if (r.kind === "research") {
    const b = BAR.research;
    if (r.unwritten) m.push("parts left unwritten");
    if (r.words < b.words) m.push(`${r.words} words (bar ${b.words})`);
    if (r.quotations < b.quotations) m.push(`${r.quotations} quotations (bar ${b.quotations})`);
    if (r.notFound) m.push(`${r.notFound} quotations not found`);
    if (r.citations) m.push(`${r.citations} citation problems`);
    if ((r.pages ?? 0) < b.pages) m.push(`${r.pages ?? 0} pages read (bar ${b.pages})`);
    if ((r.figuresNotInPages ?? 0) > b.figuresNotInPages)
      m.push(`${r.figuresNotInPages} figures in no page read (bar ${b.figuresNotInPages})`);
  } else {
    const b = BAR.article;
    if (r.words < b.words) m.push(`${r.words} words (bar ${b.words})`);
    if (r.quotations < b.quotations) m.push(`${r.quotations} quotations (bar ${b.quotations})`);
    if (r.notFound) m.push(`${r.notFound} quotations not word for word`);
    for (const p of r.publishProblems ?? []) m.push(p);
  }
  return { pass: m.length === 0, misses: m };
}
