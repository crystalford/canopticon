// Read it (docs/read-it.md): Claude reads one document, whole, once, and lays
// out what is in it as cards the author keeps or dismisses.
//
// The handoff's rules, kept here in code where code can keep them:
//   - every card rests on a span of the document's own text, located in code;
//     the span stored is the document's, never the model's wording, and a
//     span that is not found is dropped and counted (always shown);
//   - the document's own labels (a figure's rating, a claim's standing) are
//     carried as written, never assigned;
//   - only findings and reasoning may be used as evidence (contract §2b);
//   - what the file's structure already says (Key Findings, Caveats, Sources,
//     question headings) is taken first, with no model;
//   - a possible article whose thesis the document already states is a
//     summary, not an article (contract §3 rule 11), and one resting on no
//     verified finding is never shown;
//   - dismissed is forever: a re-read never proposes it again.

import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { Env } from "../env";
import { all, one, run } from "../lib/d1";
import { verbatimNormal } from "./check";

// ---- kinds -----------------------------------------------------------------------

export const NOTE_KINDS = [
  "figure",
  "finding",
  "question_answered",
  "question_open",
  "thesis",
  "prediction",
  "caveat",
  "coinage",
  "open_problem",
  "held",
] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];
export type DerivationKind = NoteKind | "pitch";
export type Role = "finding" | "reasoning" | "recommendation" | "premise";

export const KIND_LABEL: Record<DerivationKind, string> = {
  figure: "Key figure",
  finding: "Finding",
  question_answered: "Question it answers",
  question_open: "Question it raises",
  thesis: "Its thesis",
  prediction: "Prediction",
  caveat: "Caveat",
  coinage: "Coined name",
  open_problem: "Open problem",
  held: "About the author",
  pitch: "Possible article",
};

export interface Derivation {
  id: string;
  readId: string;
  docId: string;
  kind: DerivationKind;
  origin: "shape" | "read";
  role?: Role | undefined;
  span: string;
  section?: string | undefined;
  /** Kind-specific fields: figure, measures, period, attributed_to,
   *  source_rating, rejected, standing, question, answer, resolves_when,
   *  flag (a coinage's novelty span), thesis, supports, counter, proof. */
  data: Record<string, unknown>;
  status: "proposed" | "kept" | "dismissed";
  toolUseId?: string | undefined;
  createdAt: string;
}

export interface ReadRow {
  id: string;
  docId: string;
  draftId?: string | undefined;
  status: "reading" | "read" | "shown";
  model?: string | undefined;
  charsHeld: number;
  charsRead: number;
  verified: number;
  dropped: number;
  cents: number;
  startedAt: string;
  finishedAt?: string | undefined;
  shownAt?: string | undefined;
}

// ---- locating a span in the document ----------------------------------------------

const stripEmphasis = (s: string) => verbatimNormal(s);

/** Find a span in the document and return the document's own text for it:
 *  exact first, then with whitespace collapsed, then with Markdown emphasis
 *  stripped from both. Nothing else is forgiven. Spans under 8 characters are
 *  too short to anchor anything. */
export function locateSpan(doc: string, span: string): string | null {
  const want = span.trim();
  if (want.length < 8) return null;
  const at = doc.indexOf(want);
  if (at >= 0) return want;
  const collapsed = locateCollapsed(doc, want);
  if (collapsed) return collapsed;
  // Emphasis aside — and still at least 8 characters once it is gone, so
  // "**3.2%**" cannot land on any 3.2% in the document.
  const bare = stripEmphasis(want).trim();
  if (bare.length < 8) return null;
  return locateCollapsed(stripEmphasis(doc), bare);
}

function locateCollapsed(doc: string, want: string): string | null {
  const norm = want.replace(/\s+/g, " ");
  if (!norm.trim()) return null;
  const map: number[] = [];
  let flat = "";
  let space = false;
  for (let i = 0; i < doc.length; i++) {
    const ch = doc[i] ?? "";
    if (/\s/.test(ch)) {
      if (space) continue;
      flat += " ";
      map.push(i);
      space = true;
    } else {
      flat += ch;
      map.push(i);
      space = false;
    }
  }
  const p = flat.indexOf(norm);
  if (p < 0) return null;
  const start = map[p] ?? 0;
  const end = (map[p + norm.length - 1] ?? start) + 1;
  return doc.slice(start, end);
}

/** The key a dismissal is remembered by: the words, not how they were
 *  matched (emphasis and spacing aside). */
export const ignoreKey = (kind: string, span: string) =>
  `${kind}:${stripEmphasis(span).replace(/\s+/g, " ").trim().toLowerCase().slice(0, 240)}`;

/** A card's key: a possible article is its thesis, anything else its span. */
export const cardKey = (d: Pick<Derivation, "kind" | "span" | "data">) =>
  d.kind === "pitch" ? ignoreKey("pitch", String(d.data.thesis ?? "")) : ignoreKey(d.kind, d.span);

// ---- what the file's own structure says (no model) --------------------------------

interface Section {
  heading: string;
  level: number;
  lines: string[];
}

function sections(body: string): Section[] {
  const out: Section[] = [{ heading: "", level: 0, lines: [] }];
  for (const line of body.split("\n")) {
    const h = /^(#{1,4})\s+(.+?)\s*#*\s*$/.exec(line);
    if (h)
      out.push({
        heading: (h[2] ?? "").replace(/[*_`]/g, "").trim(),
        level: (h[1] ?? "").length,
        lines: [],
      });
    else out[out.length - 1]?.lines.push(line);
  }
  return out;
}

const bullets = (lines: string[]) =>
  lines
    .map((l) => /^\s{0,3}(?:[-*+]|\d+[.)])\s+(.+)$/.exec(l)?.[1]?.trim() ?? "")
    .filter((t) => t.length >= 20);

export interface ShapeCard {
  kind: "finding" | "caveat" | "question_answered";
  span: string;
  section: string;
  /** A question heading's answer: the first paragraph under it. */
  answer?: string;
}

/** The first paragraph of a section: its lines up to the first blank line,
 *  skipping a list or table (the answer is prose). */
const firstParagraph = (lines: string[]) => {
  const out: string[] = [];
  for (const l of lines) {
    if (!l.trim()) {
      if (out.length) break;
      continue;
    }
    if (!out.length && /^\s*([-*+|>]|\d+[.)])/.test(l)) return "";
    out.push(l);
  }
  return out.join("\n").trim();
};

/** Key Findings and Caveats bullets, and question-shaped headings, as the
 *  document writes them. Sources are counted, not carded. */
export function shapeOf(body: string): { cards: ShapeCard[]; sources: number } {
  const cards: ShapeCard[] = [];
  let sources = 0;
  for (const s of sections(body)) {
    const h = s.heading.toLowerCase();
    if (/^key findings?\b/.test(h))
      for (const b of bullets(s.lines))
        cards.push({ kind: "finding", span: b, section: s.heading });
    else if (/^(caveats?|limitations)\b/.test(h))
      for (const b of bullets(s.lines)) cards.push({ kind: "caveat", span: b, section: s.heading });
    else if (/^(sources|references)\b/.test(h)) sources += bullets(s.lines).length;
    // A question heading is answered by what follows it.
    const answer = firstParagraph(s.lines);
    if (s.level >= 2 && /\?$/.test(s.heading) && s.heading.length >= 15 && answer.length >= 20)
      cards.push({ kind: "question_answered", span: answer, section: s.heading, answer });
  }
  return { cards, sources };
}

// ---- storage ----------------------------------------------------------------------

export interface ReadStore {
  start(docId: string, draftId: string, charsHeld: number): Promise<ReadRow>;
  get(id: string): Promise<ReadRow | null>;
  latest(docId: string): Promise<ReadRow | null>;
  update(id: string, patch: Partial<Omit<ReadRow, "id" | "docId">>): Promise<void>;
  /** Add to the receipt's counters in one statement (no read-then-write). */
  bump(id: string, by: { verified?: number; dropped?: number; cents?: number }): Promise<void>;
  /** Reading → read, only if it is still reading ("Show on the page" wins). */
  finish(id: string, model: string): Promise<void>;
  add(d: Omit<Derivation, "id" | "createdAt">): Promise<Derivation>;
  derivations(readId: string): Promise<Derivation[]>;
  derivation(id: string): Promise<Derivation | null>;
  decide(id: string, status: Derivation["status"]): Promise<void>;
  isIgnored(docId: string, key: string): Promise<boolean>;
  ignore(docId: string, kind: string, key: string): Promise<void>;
  /** What the public page shows: kept cards of the document's shown read. */
  shown(docId: string): Promise<ShownRead | null>;
  /** Every document's shown read with its kept cards, for the site overlay. */
  shownAll(): Promise<ShownRead[]>;
  /** The latest read of every document, with how many cards are kept, for Admin. */
  latestAll(): Promise<Map<string, ReadBadge>>;
  /** Replace a card's structured fields (a pitch records the draft it started). */
  setData(id: string, data: Record<string, unknown>): Promise<void>;
}

/** A read with its counts, for Admin: kept, and proposed (what needs you). */
export type ReadBadge = ReadRow & { kept: number; proposed?: number };

export interface ShownRead {
  read: ReadRow;
  cards: Derivation[];
}

const newId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16);
const now = () => new Date().toISOString();

interface ReadDbRow {
  id: string;
  doc_id: string;
  draft_id: string | null;
  status: string;
  model: string | null;
  chars_held: number;
  chars_read: number;
  verified: number;
  dropped: number;
  cents: number;
  started_at: string;
  finished_at: string | null;
  shown_at: string | null;
}
const readFrom = (r: ReadDbRow): ReadRow => ({
  id: r.id,
  docId: r.doc_id,
  draftId: r.draft_id ?? undefined,
  status: r.status === "shown" ? "shown" : r.status === "read" ? "read" : "reading",
  model: r.model ?? undefined,
  charsHeld: r.chars_held,
  charsRead: r.chars_read,
  verified: r.verified,
  dropped: r.dropped,
  cents: r.cents,
  startedAt: r.started_at,
  finishedAt: r.finished_at ?? undefined,
  shownAt: r.shown_at ?? undefined,
});

interface DerivDbRow {
  id: string;
  read_id: string;
  doc_id: string;
  kind: string;
  origin: string;
  role: string | null;
  span: string;
  section: string | null;
  data: string;
  status: string;
  tool_use_id: string | null;
  created_at: string;
}
const derivFrom = (r: DerivDbRow): Derivation => ({
  id: r.id,
  readId: r.read_id,
  docId: r.doc_id,
  kind: r.kind as DerivationKind,
  origin: r.origin === "shape" ? "shape" : "read",
  role: (r.role ?? undefined) as Role | undefined,
  span: r.span,
  section: r.section ?? undefined,
  data: (() => {
    try {
      return JSON.parse(r.data) as Record<string, unknown>;
    } catch {
      return {};
    }
  })(),
  status: r.status === "kept" ? "kept" : r.status === "dismissed" ? "dismissed" : "proposed",
  toolUseId: r.tool_use_id ?? undefined,
  createdAt: r.created_at,
});

const READ_COLS: Record<string, string> = {
  status: "status",
  model: "model",
  charsHeld: "chars_held",
  charsRead: "chars_read",
  verified: "verified",
  dropped: "dropped",
  cents: "cents",
  finishedAt: "finished_at",
  shownAt: "shown_at",
  draftId: "draft_id",
};

export function d1Reads(env: Env, userId: string): ReadStore {
  const db = env.DB;
  const store: ReadStore = {
    async start(docId, draftId, charsHeld) {
      const r: ReadRow = {
        id: newId(),
        docId,
        draftId,
        status: "reading",
        charsHeld,
        charsRead: 0,
        verified: 0,
        dropped: 0,
        cents: 0,
        startedAt: now(),
      };
      await run(
        db,
        "INSERT INTO reads (id, user_id, doc_id, draft_id, status, chars_held, started_at) VALUES (?, ?, ?, ?, 'reading', ?, ?)",
        [r.id, userId, docId, draftId, charsHeld, r.startedAt],
      );
      return r;
    },
    async get(id) {
      const r = await one<ReadDbRow>(db, "SELECT * FROM reads WHERE id = ? AND user_id = ?", [
        id,
        userId,
      ]).catch(() => null);
      return r ? readFrom(r) : null;
    },
    async latest(docId) {
      const r = await one<ReadDbRow>(
        db,
        "SELECT * FROM reads WHERE doc_id = ? AND user_id = ? ORDER BY started_at DESC LIMIT 1",
        [docId, userId],
      ).catch(() => null);
      return r ? readFrom(r) : null;
    },
    async bump(id, by) {
      await run(
        db,
        "UPDATE reads SET verified = verified + ?, dropped = dropped + ?, cents = cents + ? WHERE id = ? AND user_id = ?",
        [by.verified ?? 0, by.dropped ?? 0, by.cents ?? 0, id, userId],
      );
    },
    async finish(id, model) {
      await run(
        db,
        "UPDATE reads SET status = 'read', model = ?, finished_at = ? WHERE id = ? AND user_id = ? AND status = 'reading'",
        [model, now(), id, userId],
      );
    },
    async update(id, patch) {
      const sets: string[] = [];
      const args: unknown[] = [];
      for (const [k, v] of Object.entries(patch)) {
        const col = READ_COLS[k];
        if (!col || v === undefined) continue;
        sets.push(`${col} = ?`);
        args.push(v);
      }
      if (!sets.length) return;
      await run(db, `UPDATE reads SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`, [
        ...args,
        id,
        userId,
      ]);
    },
    async add(d) {
      const full: Derivation = { ...d, id: newId(), createdAt: now() };
      await run(
        db,
        `INSERT INTO derivations (id, user_id, read_id, doc_id, kind, origin, role, span, section, data, status, tool_use_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          full.id,
          userId,
          full.readId,
          full.docId,
          full.kind,
          full.origin,
          full.role ?? null,
          full.span,
          full.section ?? null,
          JSON.stringify(full.data),
          full.status,
          full.toolUseId ?? null,
          full.createdAt,
        ],
      );
      return full;
    },
    async derivations(readId) {
      const rows = await all<DerivDbRow>(
        db,
        "SELECT * FROM derivations WHERE read_id = ? AND user_id = ? ORDER BY created_at",
        [readId, userId],
      ).catch(() => [] as DerivDbRow[]);
      return rows.map(derivFrom);
    },
    async derivation(id) {
      const r = await one<DerivDbRow>(
        db,
        "SELECT * FROM derivations WHERE id = ? AND user_id = ?",
        [id, userId],
      ).catch(() => null);
      return r ? derivFrom(r) : null;
    },
    async decide(id, status) {
      await run(
        db,
        "UPDATE derivations SET status = ?, decided_at = ? WHERE id = ? AND user_id = ?",
        [status, now(), id, userId],
      );
    },
    async isIgnored(docId, key) {
      const r = await one<{ key: string }>(
        db,
        "SELECT key FROM read_ignores WHERE user_id = ? AND doc_id = ? AND key = ?",
        [userId, docId, key],
      ).catch(() => null);
      return !!r;
    },
    async ignore(docId, kind, key) {
      await run(
        db,
        "INSERT OR IGNORE INTO read_ignores (user_id, doc_id, kind, key, created_at) VALUES (?, ?, ?, ?, ?)",
        [userId, docId, kind, key, now()],
      );
    },
    async shown(docId) {
      const r = await one<ReadDbRow>(
        db,
        "SELECT * FROM reads WHERE doc_id = ? AND user_id = ? AND status = 'shown' ORDER BY shown_at DESC LIMIT 1",
        [docId, userId],
      ).catch(() => null);
      if (!r) return null;
      const cards = (await store.derivations(r.id)).filter((d) => d.status === "kept");
      return { read: readFrom(r), cards };
    },
    async shownAll() {
      const rows = await all<ReadDbRow>(
        db,
        "SELECT * FROM reads WHERE user_id = ? AND status = 'shown' ORDER BY shown_at DESC",
        [userId],
      ).catch(() => [] as ReadDbRow[]);
      // One shown read per document: the latest shown.
      const latest = new Map<string, ReadDbRow>();
      for (const r of rows) if (!latest.has(r.doc_id)) latest.set(r.doc_id, r);
      if (!latest.size) return [];
      // A join, not an IN list: D1 binds at most 100 parameters.
      const cards = await all<DerivDbRow>(
        db,
        `SELECT d.* FROM derivations d JOIN reads r ON r.id = d.read_id
          WHERE d.user_id = ? AND d.status = 'kept' AND r.status = 'shown'
          ORDER BY d.created_at`,
        [userId],
      ).catch(() => [] as DerivDbRow[]);
      return [...latest.values()].map((r) => ({
        read: readFrom(r),
        cards: cards.filter((c) => c.read_id === r.id).map(derivFrom),
      }));
    },
    async latestAll() {
      type Counted = ReadDbRow & { kept: number; proposed: number };
      const rows = await all<Counted>(
        db,
        `SELECT r.*, (SELECT COUNT(*) FROM derivations d WHERE d.read_id = r.id AND d.status = 'kept') AS kept,
                (SELECT COUNT(*) FROM derivations d WHERE d.read_id = r.id AND d.status = 'proposed') AS proposed
           FROM reads r WHERE r.user_id = ? ORDER BY r.started_at DESC`,
        [userId],
      ).catch(() => [] as Counted[]);
      const out = new Map<string, ReadBadge>();
      for (const r of rows)
        if (!out.has(r.doc_id))
          out.set(r.doc_id, { ...readFrom(r), kept: r.kept ?? 0, proposed: r.proposed ?? 0 });
      return out;
    },
    async setData(id, data) {
      await run(db, "UPDATE derivations SET data = ? WHERE id = ? AND user_id = ?", [
        JSON.stringify(data),
        id,
        userId,
      ]);
    },
  };
  return store;
}

/** For tests: the same contract, in memory. */
export function memoryReads(): ReadStore & {
  rows: Map<string, ReadRow>;
  cards: Map<string, Derivation>;
} {
  const rows = new Map<string, ReadRow>();
  const cards = new Map<string, Derivation>();
  const ignores = new Set<string>();
  const store = {
    rows,
    cards,
    async start(docId: string, draftId: string, charsHeld: number) {
      const r: ReadRow = {
        id: newId(),
        docId,
        draftId,
        status: "reading" as const,
        charsHeld,
        charsRead: 0,
        verified: 0,
        dropped: 0,
        cents: 0,
        startedAt: now(),
      };
      rows.set(r.id, r);
      return r;
    },
    async get(id: string) {
      return rows.get(id) ?? null;
    },
    async latest(docId: string) {
      return (
        [...rows.values()]
          .filter((r) => r.docId === docId)
          .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0] ?? null
      );
    },
    async bump(id: string, by: { verified?: number; dropped?: number; cents?: number }) {
      const r = rows.get(id);
      if (r)
        rows.set(id, {
          ...r,
          verified: r.verified + (by.verified ?? 0),
          dropped: r.dropped + (by.dropped ?? 0),
          cents: r.cents + (by.cents ?? 0),
        });
    },
    async finish(id: string, model: string) {
      const r = rows.get(id);
      if (r?.status === "reading") rows.set(id, { ...r, status: "read", model, finishedAt: now() });
    },
    async update(id: string, patch: Partial<ReadRow>) {
      const r = rows.get(id);
      if (r)
        rows.set(id, {
          ...r,
          ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)),
        });
    },
    async add(d: Omit<Derivation, "id" | "createdAt">) {
      const full: Derivation = { ...d, id: newId(), createdAt: now() };
      cards.set(full.id, full);
      return full;
    },
    async derivations(readId: string) {
      return [...cards.values()].filter((d) => d.readId === readId);
    },
    async derivation(id: string) {
      return cards.get(id) ?? null;
    },
    async decide(id: string, status: Derivation["status"]) {
      const d = cards.get(id);
      if (d) cards.set(id, { ...d, status });
    },
    async isIgnored(docId: string, key: string) {
      return ignores.has(`${docId}\u0000${key}`);
    },
    async ignore(docId: string, _kind: string, key: string) {
      ignores.add(`${docId}\u0000${key}`);
    },
    async shown(docId: string) {
      const r = [...rows.values()]
        .filter((x) => x.docId === docId && x.status === "shown")
        .sort((a, b) => (b.shownAt ?? "").localeCompare(a.shownAt ?? ""))[0];
      if (!r) return null;
      return {
        read: r,
        cards: [...cards.values()].filter((d) => d.readId === r.id && d.status === "kept"),
      };
    },
    async shownAll() {
      const docs = new Set(
        [...rows.values()].filter((r) => r.status === "shown").map((r) => r.docId),
      );
      const out: ShownRead[] = [];
      for (const d of docs) {
        const s = await store.shown(d);
        if (s) out.push(s);
      }
      return out;
    },
    async latestAll() {
      const out = new Map<string, ReadBadge>();
      const count = (id: string, status: string) =>
        [...cards.values()].filter((c) => c.readId === id && c.status === status).length;
      for (const r of [...rows.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt)))
        if (!out.has(r.docId))
          out.set(r.docId, { ...r, kept: count(r.id, "kept"), proposed: count(r.id, "proposed") });
      return out;
    },
    async setData(id: string, data: Record<string, unknown>) {
      const d = cards.get(id);
      if (d) cards.set(id, { ...d, data });
    },
  };
  return store;
}

// ---- what Claude is told -------------------------------------------------------------

export const READ_HOW = `You read one research document for Canopticon, a public research record, with its author, Chris Telford. He pressed "Read it". Your job is to read the whole document once and lay out what is in it as cards he keeps or dismisses. You do not write prose for publication; you find what the document says and anchor every card to its own words.

HOW
1. Read the whole document with read_document (one call; it returns all of it). Read it all before noting anything.
2. The document's own structure has already been taken without you: its Key Findings and Caveats bullets and its question-shaped headings are cards already. Do not repeat them. Your job is what the structure does not give: the Details, where the evidence and mechanism are.
3. Note each thing with note, one card per call; send many note calls in one message, not one message per card. Every card rests on a span COPIED EXACTLY from the document — same words, same punctuation; it is located in code, and a span that is not found is dropped and counted against the read.
4. When you have covered the document, stop and say in the chat, briefly, what you found and anything the author should look at.

WHAT TO NOTE (be complete about what carries the document, selective about the rest)
- figure: a number the argument rests on. figure is the number as written; measures says what it is a number of; period and attributed_to as the document gives them (null if it does not); source_rating is the document's OWN word for the source if it gives one ("vendor claim", "assumption", "peer-reviewed"), never yours. If the document says not to rely on it, rejected: true. Eight good figures beat forty restatements; skip duplicates and skip numbers in advice.
- finding / reasoning: with role. finding = a fact about the world with a source; reasoning = the document's own inference. Carry the document's own standing word if it gives one ("established", "emerging", "speculation", "interpretation, not a finding"), never upgraded, never assigned by you.
- recommendations and premises: role recommendation = advice to the author ("build first…", "we should…"); role premise = the author's own decision or assumption echoed back ("given your decision…"). Note the important ones with their role so they are never mistaken for evidence.
- question_answered: question as a person would ask it, and answer_span = the document's answer, verbatim.
- question_open: something the document says it could not find or settle ("I found no study…", "no data exists…"); span = that statement.
- thesis: the sentence where the document states its own central claim or names its contribution as new. Only if it states one.
- prediction: a dated or checkable expectation; resolves_when if the document says.
- caveat: a limit the document places on its own findings, beyond its Caveats section.
- coinage: the document proposes a NAME for a pattern, mechanism or failure that happens and marks it as new. span = where it names it; flag_span = where it says it is new ("a coinage", "no single name exists"). Both required. Never a name for something to build (a product, a feature, a plan) — that is a recommendation.
- open_problem: the document concludes that something wanted does not exist yet (a product, a dataset, a study) and says why; span = the obstacle as the document states it.
- held: the document is about the author personally (health, family, finances); span = the passage that shows it. Note once.

POSSIBLE ARTICLES (pitch)
After the cards, propose up to three articles this document could carry, with pitch. Each is a thesis line in your words that a curious reader would not reach alone — it must NOT be a sentence the document already states (that would be a summary). Support it with the spans that carry it (findings and reasoning only; recommendations and premises never count as evidence), say each span's role, and give the strongest counter from the document. A pitch is shown only if verified findings or reasoning carry it; fewer than eight is marked thin. Never a thesis about a person or organisation. Never one line from each of several fields — an article argues one idea from evidence, not an analogy.

NEVER
Grade the document. Reconcile it with other documents. Summarise it. Write the author's reasons. Add a judgement the document does not make.`;

export const NOTE_TOOL: Anthropic.Beta.BetaToolUnion = {
  name: "note",
  description:
    "Note one card: a figure, finding, question, thesis, prediction, caveat, coined name, open problem or a passage about the author. The span must be copied exactly from the document.",
  input_schema: {
    type: "object",
    properties: {
      kind: { type: "string", enum: [...NOTE_KINDS] },
      span: { type: "string", description: "Copied exactly from the document" },
      section: { type: "string", description: "The heading of the part it comes from" },
      role: { type: "string", enum: ["finding", "reasoning", "recommendation", "premise"] },
      standing: {
        type: "string",
        description: "The document's own word for its standing, if it gives one",
      },
      figure: { type: "string" },
      measures: { type: "string" },
      period: { type: "string" },
      attributed_to: { type: "string" },
      source_rating: { type: "string" },
      rejected: { type: "boolean" },
      question: { type: "string" },
      answer_span: { type: "string" },
      resolves_when: { type: "string" },
      flag_span: { type: "string" },
    },
    required: ["kind", "span"],
  },
};

export const PITCH_TOOL: Anthropic.Beta.BetaToolUnion = {
  name: "pitch",
  description:
    "Propose a possible article this document could carry: a thesis line the document does not already state, the spans that support it (each copied exactly, with its role), and the strongest counter from the document.",
  input_schema: {
    type: "object",
    properties: {
      thesis: { type: "string" },
      supports: {
        type: "array",
        items: {
          type: "object",
          properties: {
            span: { type: "string" },
            role: { type: "string", enum: ["finding", "reasoning", "recommendation", "premise"] },
            section: { type: "string" },
          },
          required: ["span", "role"],
        },
      },
      counter: {
        type: "string",
        description: "The strongest counter, copied exactly from the document",
      },
    },
    required: ["thesis", "supports"],
  },
};

// ---- running a card tool --------------------------------------------------------------

const NoteInput = z.object({
  kind: z.enum(NOTE_KINDS),
  span: z.string().min(1),
  section: z.string().optional(),
  role: z.enum(["finding", "reasoning", "recommendation", "premise"]).optional(),
  standing: z.string().optional(),
  figure: z.string().optional(),
  measures: z.string().optional(),
  period: z.string().optional(),
  attributed_to: z.string().optional(),
  source_rating: z.string().optional(),
  rejected: z.boolean().optional(),
  question: z.string().optional(),
  answer_span: z.string().optional(),
  resolves_when: z.string().optional(),
  flag_span: z.string().optional(),
});
const PitchInput = z.object({
  thesis: z.string().min(10),
  supports: z.array(
    z.object({
      span: z.string(),
      role: z.enum(["finding", "reasoning", "recommendation", "premise"]),
      section: z.string().optional(),
    }),
  ),
  counter: z.string().optional(),
});

export const THIN_PROOF = 8;

export interface ReadToolContext {
  reads: ReadStore;
  readId: string;
  docId: string;
  doc: string;
  toolUseId?: string | undefined;
}

export type ReadToolResult = { text: string; error?: boolean; card?: Derivation };

const drop = (t: ReadToolContext, n = 1) => t.reads.bump(t.readId, { dropped: n });
const verified = (t: ReadToolContext, n = 1) => t.reads.bump(t.readId, { verified: n });

export async function runReadTool(
  name: string,
  input: unknown,
  t: ReadToolContext,
): Promise<ReadToolResult> {
  if (name === "note") {
    const p = NoteInput.safeParse(input);
    if (!p.success) return { text: "Give at least kind and span.", error: true };
    const n = p.data;
    const span = locateSpan(t.doc, n.span);
    if (!span) {
      await drop(t);
      return {
        text: "Dropped: that span is not in the document word for word. Copy it exactly, or leave it.",
        error: true,
      };
    }
    const key = ignoreKey(n.kind, span);
    if (await t.reads.isIgnored(t.docId, key))
      return { text: "The author dismissed this before; it stays dismissed. Move on." };
    const existing = await t.reads.derivations(t.readId);
    if (existing.some((d) => cardKey(d) === key)) return { text: "Already noted." };
    const data: Record<string, unknown> = {};
    if (n.kind === "figure") {
      if (!n.figure || !span.includes(n.figure.trim()))
        return {
          text: "A figure must be given exactly as it appears inside the span.",
          error: true,
        };
      if (!n.measures) return { text: "Say what the figure measures.", error: true };
      Object.assign(data, {
        figure: n.figure.trim(),
        measures: n.measures,
        period: n.period ?? null,
        attributed_to: n.attributed_to ?? null,
        source_rating: n.source_rating ?? null,
        rejected: n.rejected === true,
      });
    }
    if (n.kind === "question_answered") {
      if (!n.question) return { text: "Give the question.", error: true };
      const answer = n.answer_span ? locateSpan(t.doc, n.answer_span) : null;
      if (!answer) {
        await drop(t);
        return {
          text: "Dropped: the answer span is not in the document word for word.",
          error: true,
        };
      }
      Object.assign(data, { question: n.question, answer });
    }
    if (n.kind === "question_open" && n.question) data.question = n.question;
    if (n.kind === "coinage") {
      const flag = n.flag_span ? locateSpan(t.doc, n.flag_span) : null;
      if (!flag) {
        await drop(t);
        return {
          text: "Dropped: a coined name needs the span where the document says it is new, word for word.",
          error: true,
        };
      }
      data.flag = flag;
    }
    if (n.kind === "prediction" && n.resolves_when) data.resolves_when = n.resolves_when;
    if (n.standing) data.standing = n.standing;
    const card = await t.reads.add({
      readId: t.readId,
      docId: t.docId,
      kind: n.kind,
      origin: "read",
      role: n.role ?? (n.kind === "finding" ? "finding" : undefined),
      span,
      section: n.section,
      data,
      status: "proposed",
      toolUseId: t.toolUseId,
    });
    await verified(t);
    return { text: "Noted.", card };
  }

  if (name === "pitch") {
    const p = PitchInput.safeParse(input);
    if (!p.success) return { text: "Give a thesis and its supports.", error: true };
    if (locateSpan(t.doc, p.data.thesis))
      return {
        text: "Refused: the document already states this thesis. An article that restates one document is a summary (contract §3 rule 11). Find the idea the document does not state.",
        error: true,
      };
    const key = ignoreKey("pitch", p.data.thesis);
    if (await t.reads.isIgnored(t.docId, key))
      return { text: "The author dismissed this before; it stays dismissed. Move on." };
    if ((await t.reads.derivations(t.readId)).some((d) => cardKey(d) === key))
      return { text: "Already proposed." };
    // Each passage counts once, however often it is offered.
    const supports: Array<{ span: string; role: Role; section?: string | undefined }> = [];
    const seen = new Set<string>();
    let failed = 0;
    for (const s of p.data.supports) {
      const found = locateSpan(t.doc, s.span);
      if (!found) {
        failed++;
        continue;
      }
      const k = ignoreKey("support", found);
      if (seen.has(k)) continue;
      seen.add(k);
      supports.push({ span: found, role: s.role, section: s.section });
    }
    if (failed) await drop(t, failed);
    const proof = supports.filter((s) => s.role === "finding" || s.role === "reasoning").length;
    if (proof === 0)
      return {
        text: `Not shown: no verified finding or reasoning carries it${failed ? ` (${failed} spans were not in the document)` : ""}.`,
        error: true,
      };
    const counter = p.data.counter ? locateSpan(t.doc, p.data.counter) : null;
    const card = await t.reads.add({
      readId: t.readId,
      docId: t.docId,
      kind: "pitch",
      origin: "read",
      span: supports[0]?.span ?? "",
      section: supports[0]?.section,
      data: { thesis: p.data.thesis, supports, counter, proof, thin: proof < THIN_PROOF },
      status: "proposed",
      toolUseId: t.toolUseId,
    });
    await verified(t, supports.length);
    return {
      text: `Proposed, resting on ${proof} verified findings or reasoning${proof < THIN_PROOF ? " (thin: fewer than eight)" : ""}${failed ? `; ${failed} spans dropped` : ""}.`,
      card,
    };
  }
  return { text: `No tool called ${name}.`, error: true };
}

/** The first turn's text when the author presses Read it. */
export const START_READ = (title: string, id: string) =>
  `Read "${title}" (id: ${id}) in full and lay out what is in it.`;

/** "Write this": the first message of an article draft started from a
 *  possible article — the thesis and the passages that carry it, each the
 *  document's own words, so Claude starts from the read rather than from
 *  nothing. Advice and the author's own decisions are named as such. */
export function pitchBrief(card: Derivation, title: string): string {
  const supports =
    (card.data.supports as Array<{ span: string; role: string; section?: string }> | undefined) ??
    [];
  const counter = typeof card.data.counter === "string" ? card.data.counter : "";
  const lines = supports.map(
    (s) =>
      `- (${s.role === "finding" || s.role === "reasoning" ? s.role : `${s.role}, not evidence`}${s.section ? `, ${s.section}` : ""}) "${s.span}"`,
  );
  return [
    `Write an article arguing: ${String(card.data.thesis ?? "")}`,
    "",
    `It comes from a read of "${title}" (id: ${card.docId}). Read the whole document first. The passages that carry it:`,
    ...lines,
    ...(counter ? ["", `The strongest counter in the document: "${counter}"`] : []),
    "",
    "Quote only findings and reasoning as evidence. Find what else in the record bears on it before you write.",
  ].join("\n");
}
