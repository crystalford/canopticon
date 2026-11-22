// WHAT CHANGED — the difference between two versions of a paper, the way a
// code review shows it: paragraphs that did not change fold away, changed
// passages show removed words struck through and added words marked. Pure,
// no model, computed from the two texts the record already keeps.

export type Op = { t: "eq" | "del" | "ins"; v: string };

/** Longest-common-subsequence diff of two token lists. */
export function diffTokens(a: string[], b: string[]): Op[] {
  const n = a.length;
  const m = b.length;
  const w = m + 1;
  const L = new Uint32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      L[i * w + j] =
        a[i] === b[j]
          ? (L[(i + 1) * w + j + 1] as number) + 1
          : Math.max(L[(i + 1) * w + j] as number, L[i * w + j + 1] as number);
  const out: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ t: "eq", v: a[i] as string });
      i++;
      j++;
    } else if ((L[(i + 1) * w + j] as number) >= (L[i * w + j + 1] as number)) {
      out.push({ t: "del", v: a[i++] as string });
    } else out.push({ t: "ins", v: b[j++] as string });
  }
  while (i < n) out.push({ t: "del", v: a[i++] as string });
  while (j < m) out.push({ t: "ins", v: b[j++] as string });
  return out;
}

/** A paper's Markdown as paragraphs, front matter dropped. */
export function paragraphs(md: string): string[] {
  return md
    .replace(/^---\n[\s\S]*?\n---\n?/, "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Words, keeping line breaks as their own tokens so lists survive. */
function words(p: string): string[] {
  return p.split(/(\n)|[ \t]+/).filter((x): x is string => !!x);
}

export type Block =
  | { kind: "same"; paras: string[] }
  | { kind: "changed"; ops: Op[]; removed: number; added: number };

/** Paragraph-level diff, then word-level inside each changed run. */
export function diffParagraphs(before: string, after: string): Block[] {
  const ops = diffTokens(paragraphs(before), paragraphs(after));
  const blocks: Block[] = [];
  let k = 0;
  while (k < ops.length) {
    if ((ops[k] as Op).t === "eq") {
      const paras: string[] = [];
      while (k < ops.length && (ops[k] as Op).t === "eq") paras.push((ops[k++] as Op).v);
      blocks.push({ kind: "same", paras });
      continue;
    }
    const del: string[] = [];
    const ins: string[] = [];
    while (k < ops.length && (ops[k] as Op).t !== "eq") {
      const o = ops[k++] as Op;
      (o.t === "del" ? del : ins).push(o.v);
    }
    const PARA = " ";
    const a = del.flatMap((p, i) => (i ? [PARA, ...words(p)] : words(p)));
    const b = ins.flatMap((p, i) => (i ? [PARA, ...words(p)] : words(p)));
    const wordOps = diffTokens(a, b);
    blocks.push({
      kind: "changed",
      ops: wordOps,
      removed: wordOps.filter((o) => o.t === "del" && o.v !== PARA && o.v !== "\n").length,
      added: wordOps.filter((o) => o.t === "ins" && o.v !== PARA && o.v !== "\n").length,
    });
  }
  return blocks;
}
