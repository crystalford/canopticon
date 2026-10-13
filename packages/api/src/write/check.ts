// The verbatim check for a draft — the same rule the build applies to every
// published article (scripts/build-content.mjs, ESSAY-CONTRACT §4): a quote
// must be a literal substring of its document once Markdown emphasis and
// backticks are stripped from both. Nothing else is normalised: not curly
// quotes, not whitespace. The workspace runs it on every write so a failing
// quote shows in red while the draft is still being written, not at publish.

/** Exactly scripts/build-content.mjs's verbatimNormal (tests pin the two). */
export function verbatimNormal(s: string): string {
  return s.replace(/[*`]/g, "");
}

export interface DraftQuote {
  doc: string;
  section: string;
  text: string;
  /** "q" for an inline <q>, "pull" for a pull-quote figure. */
  kind: "q" | "pull";
}

/** Every quotation in a draft: inline <q> spans and pull-quote figures. */
export function draftQuotes(body: string): DraftQuote[] {
  const out: DraftQuote[] = [];
  for (const m of body.matchAll(/<q\s+([^>]*)>([\s\S]*?)<\/q>/g)) {
    out.push({
      doc: /doc="([^"]*)"/.exec(m[1] ?? "")?.[1] ?? "",
      section: /section="([^"]*)"/.exec(m[1] ?? "")?.[1] ?? "",
      text: m[2] ?? "",
      kind: "q",
    });
  }
  for (const m of body.matchAll(/<figure\s+data-kind="pull"([^>]*)>\n([\s\S]*?)\n<\/figure>/g)) {
    out.push({
      doc: /doc="([^"]*)"/.exec(m[1] ?? "")?.[1] ?? "",
      section: /section="([^"]*)"/.exec(m[1] ?? "")?.[1] ?? "",
      text: (m[2] ?? "").trim().replace(/^[“"]|[”"]$/g, ""),
      kind: "pull",
    });
  }
  return out;
}

export interface QuoteFailure extends DraftQuote {
  reason: "no-document" | "not-verbatim";
}

export interface CheckResult {
  total: number;
  failed: QuoteFailure[];
}

/** Check every quote against the documents' text. `texts` maps an id to its
 *  text, or null when the id is not a document the draft may quote. */
export function checkQuotes(body: string, texts: Map<string, string | null>): CheckResult {
  const quotes = draftQuotes(body);
  const normal = new Map<string, string>();
  const failed: QuoteFailure[] = [];
  for (const q of quotes) {
    const src = texts.get(q.doc);
    if (src == null) {
      failed.push({ ...q, reason: "no-document" });
      continue;
    }
    let n = normal.get(q.doc);
    if (n === undefined) {
      n = verbatimNormal(src);
      normal.set(q.doc, n);
    }
    if (!n.includes(verbatimNormal(q.text))) failed.push({ ...q, reason: "not-verbatim" });
  }
  return { total: quotes.length, failed };
}

/** A line Claude reads back after each write, naming what failed. */
export function describeCheck(r: CheckResult): string {
  if (!r.total) return "No quotations yet.";
  if (!r.failed.length) return `${r.total} quotations, all found word for word in their documents.`;
  const lines = r.failed.map(
    (f) =>
      `- ${f.reason === "no-document" ? `"${f.doc}" is not a document you can quote` : `not word for word in ${f.doc}`}: "${f.text.slice(0, 160)}"`,
  );
  return `${r.total} quotations, ${r.failed.length} FAILED. Fix each one by copying the passage exactly from read_document, or remove it:\n${lines.join("\n")}`;
}
