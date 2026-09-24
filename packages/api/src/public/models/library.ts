// THE LIBRARY MODEL — everything /library shows, as plain data.
//
// The workbench (public/render/investigations.ts) used to run its queries and
// build its HTML in one pass. This module is the seam between the two: one
// async function gathers what the page shows and returns a typed, JSON-safe
// value; the renderer consumes it, and GET /library.json serves it to a front
// end built against real data. Nothing here calls a model (rule 5), nothing
// here is a second copy of a stored number (rule 3) — every field is either
// a row the tables already hold or a query over them, the same helpers the
// page has always used.
//
// The camelCase names are the contract for the JSON; the snake_case graph
// types they are built from stay internal to packages/api.

import type { Env } from "../../env";
import type { LeadAnswer } from "../../graph/lib/answer-lead";
import {
  type ConsolidationSummary,
  type Lineage,
  consolidationLine,
  consolidationSummaries,
  lineageForPieces,
} from "../../graph/lib/consolidation";
import type { IngestionReceipt } from "../../graph/lib/ingestion-receipt";
import type { Lead, LeadKind } from "../../graph/lib/leads";
import {
  type ProcessingRow,
  STEP_ORDER,
  describeProcessing,
  processingCounts,
  processingRows,
} from "../../graph/lib/processing";
import { gateQuestion } from "../../lib/aeo";
import type { ResurfacedPassage } from "../../lib/resurface";
import { looksLikeMachineFilename, looksLikeWorkingTitle } from "../../lib/title";
import { titleCandidates } from "../../lib/title-candidates";
import { modelInUse } from "../../llm/router";
import { type LibraryRow, type PublicEnv, listLibrary } from "../data";
import { kindLabel } from "../render/components";

// ---- The shape ------------------------------------------------------------

export interface LibraryModelInfo {
  /** "claude_gateway" | "workers_ai" — llm/router.ts modelInUse(). */
  provider: string;
  /** The line the page prints beside "Model". */
  name: string;
  gatewayConfigured: boolean;
  /** Said in red on the page when the gateway is not configured. */
  note: string | null;
}

export interface LibraryCounts {
  documents: number;
  queued: number;
  processing: number;
  failed: number;
  done: number;
  unprocessed: number;
  /** queued + processing — what tells the poller to start. */
  active: number;
}

export interface LibraryStatus {
  state: "none" | "queued" | "running" | "done" | "failed";
  /** The one line: "Processing 3/7 · reading (2/4)", "Processed", "Not processed". */
  text: string;
  step: string | null;
  /** 1-based position of `step` in the pipeline; 0 when unprocessed or done. */
  stepIndex: number;
  stepCount: number;
  error: string | null;
  /** The model that did the work, as recorded on the row. */
  model: string | null;
  updatedAt: string | null;
}

export interface LibraryReceipt {
  charsRead: number;
  charsTotal: number;
  truncated: boolean;
  /** Share of the document extraction read, 0–100. */
  percent: number;
  verifiedSpans: number;
  facts: number;
  figures: number;
}

export interface LibraryLeadQuote {
  text: string;
  pieceId: string | null;
  slug: string | null;
  title: string | null;
  url: string | null;
}

export interface LibraryLeadAnswer {
  status: "answered" | "nothing_found" | "failed";
  answerMd: string | null;
  quotes: LibraryLeadQuote[];
  /** Proposed quotes that failed the verbatim check — shown, never hidden. */
  discarded: number;
  model: string | null;
  error: string | null;
}

export interface LibraryDig {
  /** The button's verb: "Settle this", "Dig here", "Dig again", "Research", "Has anyone said this?". */
  verb: string;
  angle: string;
}

export interface LibraryLead {
  kind: LeadKind;
  /** The kind, in the words the page uses ("sources disagree", …). */
  label: string;
  summary: string;
  detail: string;
  seed: string;
  angle: string;
  pieceId: string;
  pieceSlug: string | null;
  pieceTitle: string | null;
  otherSlug: string | null;
  otherTitle: string | null;
  quoteId: string | null;
  createdAt: string;
  answerKey: string | null;
  /** The research runs this lead offers — one per button on the page. */
  digs: LibraryDig[];
  answer: LibraryLeadAnswer | null;
}

export interface LibraryConsolidation {
  linkedTo: number;
  linkedFrom: number;
  contradictions: number;
  unsourced: number;
  bridges: number;
  questions: number;
  /** consolidationLine(): the same numbers as one sentence. */
  line: string;
}

export interface LibraryLineage {
  parentId: string | null;
  parentSlug: string | null;
  parentTitle: string | null;
  origin: string | null;
  branches: number;
}

export interface LibraryQuestion {
  id: string;
  question: string;
  status: string;
  evidenceCount: number;
  answerWords: number;
  models: string[];
  hasDraft: boolean;
  approved: boolean;
  contested: boolean;
  /** What the draft button does next: draft, approve, or nothing (approved). */
  draftStep: "draft" | "approve" | null;
  /** live: published · publish: passes the gate · held: does not, with the reason. */
  publishStep: "live" | "publish" | "held";
  heldReason: string | null;
}

export interface LibraryActionField {
  name: string;
  type: "hidden" | "file";
  value?: string;
  accept?: string;
}

export interface LibraryAction {
  kind: "retry" | "reprocess" | "replace";
  label: string;
  method: "POST";
  action: string;
  fields: LibraryActionField[];
}

export interface LibraryLintNote {
  level: string;
  message: string;
}

export interface LibraryRowModel {
  id: string;
  slug: string;
  /** The title as shown; a machine filename becomes "Untitled research document". */
  title: string;
  /** The stored title when it is a machine filename, kept visible underneath. */
  rawFilename: string | null;
  /** Where the title links: the review screen for a draft, /library/<slug> otherwise, null for working material. */
  href: string | null;
  kind: string;
  kindLabel: string;
  publicationStatus: string;
  /** The chip beside the status when publication state is not the default. */
  chip: string | null;
  isOnDemandDraft: boolean;
  isPublished: boolean;
  date: string | null;
  updatedAt: string | null;
  status: LibraryStatus;
  receipt: LibraryReceipt | null;
  /** A pipeline rename (original) or the document's own candidates — never both. */
  workingTitle: { original: string | null; candidates: string[] } | null;
  lineage: LibraryLineage | null;
  branches: number;
  leads: LibraryLead[];
  /** Only for a row the pipeline has finished. */
  consolidation: LibraryConsolidation | null;
  findings: number;
  questions: LibraryQuestion[];
  leadPassage: string | null;
  essayLint: LibraryLintNote[] | null;
  actions: LibraryAction[];
}

export interface LibraryUploaded {
  id: string;
  slug: string;
  title: string;
  status: LibraryStatus;
  consolidation: LibraryConsolidation | null;
  leads: LibraryLead[];
}

export interface LibraryResurfaced {
  pieceId: string;
  pieceSlug: string;
  pieceTitle: string;
  quoteId: string;
  text: string;
  /** The angle "Research this" sends. */
  angle: string;
}

export interface LibraryAnsweredQuestion {
  id: string;
  question: string;
  sources: number;
  evidenceCount: number;
  hasDraft: boolean;
}

export interface LibraryNotice {
  kind: "error" | "info";
  text: string;
}

export interface LibraryModel {
  /** False for the reader variant: no receipts, leads or actions. */
  operator: boolean;
  model: LibraryModelInfo;
  counts: LibraryCounts;
  /** The flash line after an upload, a queue press, a rename or a publish. */
  notice: LibraryNotice | null;
  /** The "Just uploaded" banner, in the order the ids arrived, capped at five. */
  uploaded: LibraryUploaded[];
  resurfaced: LibraryResurfaced | null;
  rows: LibraryRowModel[];
  /** What the record wants: every lead, recent-first, never by frequency. */
  worklist: LibraryLead[];
  /** Questions these documents answer — the FAQ index, not a to-do list. */
  answered: LibraryAnsweredQuestion[];
  /** The rail's Research entry is a link to the workspace; it lists no runs. */
  research: { href: string };
  maintenance: {
    processEverything: { count: number };
    advanceResearch: boolean;
  };
  /** A video import in flight (its id), so the page polls its status. */
  importing: string | null;
  videoError: string | null;
}

export interface LibraryModelOpts {
  userId: string;
  /** Reader variant when false. Defaults to true — /library is operator-only. */
  isOperator?: boolean;
  uploaded?: string;
  importing?: string;
  videoError?: string;
  ingested?: string;
  error?: string;
  published?: string;
  renamed?: string;
  queued?: string;
}

// ---- Constants the page shares -------------------------------------------

export const UPLOAD_BANNER_MAX = 5;

export const LEAD_LABEL: Record<LeadKind, string> = {
  contradiction: "sources disagree",
  "unsourced-figure": "no source named",
  bridge: "bridge between sections",
  reading: "read by the operator",
};

/**
 * The novelty check, as a research question. docs/the-record.md §1b: the
 * research pass for "The Medium Becomes the Ground" checked four literatures
 * by hand to find that nobody had made the McLuhan–allostasis connection.
 * This is that check as one button, and its answer — nobody, or these three
 * people — is itself a document.
 */
export const HAS_ANYONE_SAID_THIS_ANGLE =
  "Has anyone published this connection before? Search the literature for prior statements of it " +
  "and report who, where, when — or that none was found.";

export const RESURFACE_ANGLE =
  "The operator is re-reading this passage of a document already on the record. Answer the question against the passage: what it asks for, what it doubts, what it says is missing.";

// ---- Per-piece views (exported so the renderer's test adapters can use them)

export function statusView(row: ProcessingRow | undefined): LibraryStatus {
  const d = describeProcessing(row);
  const idx = row ? STEP_ORDER.indexOf(row.step) : -1;
  return {
    state: d.state,
    text: d.text,
    step: row?.step ?? null,
    stepIndex: row && row.status !== "done" && idx >= 0 ? idx + 1 : 0,
    stepCount: STEP_ORDER.length - 1,
    error: row?.error ?? null,
    model: row?.model ?? null,
    updatedAt: row?.updated_at ?? null,
  };
}

export function receiptView(r: IngestionReceipt | undefined): LibraryReceipt | null {
  if (!r) return null;
  return {
    charsRead: r.read_chars,
    charsTotal: r.total_chars,
    truncated: r.truncated,
    percent: r.total_chars > 0 ? Math.round((r.read_chars / r.total_chars) * 100) : 100,
    verifiedSpans: r.quotes,
    facts: r.nodes,
    figures: r.findings,
  };
}

export function leadAnswerView(a: LeadAnswer | undefined | null): LibraryLeadAnswer | null {
  if (!a) return null;
  return {
    status: a.status,
    answerMd: a.answer_md ?? null,
    quotes: a.quotes.map((q) => ({
      text: q.text,
      pieceId: q.piece_id ?? null,
      slug: q.slug ?? null,
      title: q.title ?? null,
      url: q.url ?? null,
    })),
    discarded: a.discarded ?? 0,
    model: a.model ?? null,
    error: a.error ?? null,
  };
}

/**
 * Which runs a lead offers. A contradiction is answerable from documents
 * already held, in full, with no web search — so its button says what it
 * will actually do. A bridge gets two runs: the connection itself, and
 * whether anyone has made it. A lead with no seed offers nothing.
 */
export function digsFor(l: Lead, answered: boolean): LibraryDig[] {
  if (!l.seed) return [];
  if (l.kind === "bridge") {
    return [
      { verb: "Research", angle: l.angle },
      { verb: "Has anyone said this?", angle: HAS_ANYONE_SAID_THIS_ANGLE },
    ];
  }
  const verb = answered ? "Dig again" : l.kind === "contradiction" ? "Settle this" : "Dig here";
  return [{ verb, angle: l.angle }];
}

export function leadView(l: Lead, answers?: Map<string, LeadAnswer>): LibraryLead {
  const answer = leadAnswerView(answers?.get(l.answer_key ?? ""));
  return {
    kind: l.kind,
    label: LEAD_LABEL[l.kind] ?? l.kind,
    summary: l.summary,
    detail: l.detail,
    seed: l.seed,
    angle: l.angle,
    pieceId: l.piece_id,
    pieceSlug: l.piece_slug ?? null,
    pieceTitle: l.piece_title ?? null,
    otherSlug: l.other_piece_slug ?? null,
    otherTitle: l.other_piece_title ?? null,
    quoteId: l.quote_id ?? null,
    createdAt: l.created_at,
    answerKey: l.answer_key ?? null,
    digs: digsFor(l, !!answer),
    answer,
  };
}

export function consolidationView(
  s: ConsolidationSummary | undefined,
): LibraryConsolidation | null {
  if (!s) return null;
  return {
    linkedTo: s.links_out,
    linkedFrom: s.links_in,
    contradictions: s.contradictions,
    unsourced: s.unsourced,
    bridges: s.bridges,
    questions: s.questions,
    line: consolidationLine(s),
  };
}

export function lineageView(l: Lineage | undefined): LibraryLineage | null {
  if (!l) return null;
  return {
    parentId: l.parent_id,
    parentSlug: l.parent_slug,
    parentTitle: l.parent_title,
    origin: l.origin,
    branches: l.branches,
  };
}

export function resurfacedView(r: ResurfacedPassage | null): LibraryResurfaced | null {
  if (!r) return null;
  return {
    pieceId: r.piece_id,
    pieceSlug: r.piece_slug,
    pieceTitle: r.piece_title,
    quoteId: r.quote_id,
    text: r.verbatim_text,
    angle: RESURFACE_ANGLE,
  };
}

/** Essay lint notes stored in the piece's metadata at upload; only the loud ones. */
export function lintNotes(metadataJson: string | null | undefined): LibraryLintNote[] | null {
  let notes: LibraryLintNote[] = [];
  try {
    const meta = JSON.parse(metadataJson || "{}") as { essay_lint?: LibraryLintNote[] };
    notes = Array.isArray(meta.essay_lint) ? meta.essay_lint : [];
  } catch {
    return null;
  }
  const loud = notes.filter((n) => n.level === "error" || n.level === "warn");
  return loud.length ? loud : null;
}

interface QuestionRow {
  piece_id: string;
  id: string;
  question: string;
  slug: string;
  status: string;
  evidence_count: number;
  answer_words: number;
  models?: string | null;
  has_draft?: number;
  answer_approved_at?: string | null;
  contested?: number;
}

function questionView(q: QuestionRow): LibraryQuestion {
  const gate = gateQuestion({
    evidenceCount: q.evidence_count,
    answerWords: q.answer_words,
    hasApprovedAnswer: Boolean(q.answer_approved_at),
  });
  const models = (q.models ?? "")
    .split(",")
    .map((m) => m.trim().split("/").pop() ?? "")
    .filter(Boolean);
  return {
    id: q.id,
    question: q.question,
    status: q.status,
    evidenceCount: q.evidence_count,
    answerWords: q.answer_words,
    models,
    hasDraft: Boolean(q.has_draft),
    approved: Boolean(q.answer_approved_at),
    contested: Boolean(q.contested),
    draftStep: q.has_draft ? (q.answer_approved_at ? null : "approve") : "draft",
    publishStep: q.status === "published" ? "live" : gate.publishable ? "publish" : "held",
    heldReason: q.status === "published" || gate.publishable ? null : (gate.reason ?? null),
  };
}

/** Re-process always; Retry only when the row failed; a new version always. */
export function rowActions(pieceId: string, row: ProcessingRow | undefined): LibraryAction[] {
  const out: LibraryAction[] = [];
  if (row?.status === "failed") {
    out.push({
      kind: "retry",
      label: "Retry",
      method: "POST",
      action: `/op/library/${pieceId}/retry`,
      fields: [],
    });
  }
  out.push({
    kind: "reprocess",
    label: row?.status === "queued" || row?.status === "running" ? "Restart" : "Re-process",
    method: "POST",
    action: `/op/library/${pieceId}/reprocess`,
    fields: [],
  });
  out.push({
    kind: "replace",
    label: "New version",
    method: "POST",
    action: `/op/library/${pieceId}/replace`,
    fields: [{ name: "file", type: "file", accept: ".md,.txt,.html,.pdf,.docx" }],
  });
  return out;
}

function noticeFor(opts: LibraryModelOpts): LibraryNotice | null {
  if (opts.error) return { kind: "error", text: opts.error };
  if (opts.ingested) {
    return {
      kind: "info",
      text: `Uploaded ${opts.ingested} document${opts.ingested === "1" ? "" : "s"} — processing runs while this tab is open.`,
    };
  }
  if (opts.queued) {
    return {
      kind: "info",
      text:
        opts.queued === "0"
          ? "Nothing to queue — every document is processed or already waiting."
          : `Queued ${opts.queued} document${opts.queued === "1" ? "" : "s"}. Processing runs while this tab is open.`,
    };
  }
  if (opts.renamed) return { kind: "info", text: "Title updated. The old one is kept on the row." };
  if (opts.published) return { kind: "info", text: "Answer published." };
  return null;
}

// ---- The model ------------------------------------------------------------

/** No operator account yet: the page still renders, with nothing in it. */
export function emptyLibraryModel(
  env: PublicEnv,
  opts: { isOperator?: boolean; importing?: string; videoError?: string } = {},
): LibraryModel {
  const inUse = modelInUse(env);
  return {
    operator: opts.isOperator !== false,
    model: {
      provider: inUse.provider,
      name: inUse.label,
      gatewayConfigured: inUse.configured,
      note: inUse.configured ? null : "gateway not configured",
    },
    counts: {
      documents: 0,
      queued: 0,
      processing: 0,
      failed: 0,
      done: 0,
      unprocessed: 0,
      active: 0,
    },
    notice: null,
    uploaded: [],
    resurfaced: null,
    rows: [],
    worklist: [],
    answered: [],
    research: { href: "/op/research" },
    maintenance: { processEverything: { count: 0 }, advanceResearch: true },
    importing: opts.importing ?? null,
    videoError: opts.videoError ?? null,
  };
}

export async function libraryModel(env: PublicEnv, opts: LibraryModelOpts): Promise<LibraryModel> {
  const userId = opts.userId;
  const operator = opts.isOperator !== false;
  const db = env.DB;
  const procEnv = env as unknown as Env;
  const { all } = await import("../../lib/d1");

  const pieces: LibraryRow[] = await listLibrary(db, userId, { includeUnpublished: operator });

  // working-material never gets a public page — EXCEPT an on-demand research
  // draft, which links to the operator review screen instead.
  const onDemandDrafts = new Set<string>();
  if (operator) {
    const rows = await all<{ id: string }>(
      db,
      `SELECT id FROM pieces WHERE user_id = ? AND publication_status = 'working-material'
         AND tags LIKE '%on-demand%'`,
      [userId],
    ).catch(() => []);
    for (const r of rows) onDemandDrafts.add(r.id);
  }

  // THE PIPELINE, per document and in total. One table, read once.
  const procRows = operator
    ? await processingRows(procEnv, userId)
    : new Map<string, ProcessingRow>();
  const procCounts = operator
    ? await processingCounts(procEnv, userId)
    : { queued: 0, running: 0, failed: 0, done: 0, unprocessed: 0 };

  // Proposed atoms, per document: findings count, the questions and their
  // gate, and the lead passage.
  const findingsByPiece = new Map<string, number>();
  const questionsByPiece = new Map<string, LibraryQuestion[]>();
  const ledeByPiece = new Map<string, string>();
  if (operator) {
    const fRows = await all<{ piece_id: string; n: number }>(
      db,
      "SELECT piece_id, COUNT(*) AS n FROM aeo_findings WHERE user_id = ? GROUP BY piece_id",
      [userId],
    ).catch(() => []);
    const qRows = await all<QuestionRow>(
      db,
      `SELECT DISTINCT e.piece_id, q.id, q.question, q.slug, q.status,
              (SELECT COUNT(*) FROM aeo_question_evidence e2 WHERE e2.question_id = q.id) AS evidence_count,
              (SELECT COALESCE(SUM(LENGTH(e3.answer_text) - LENGTH(REPLACE(e3.answer_text,' ','')) + 1), 0)
                 FROM aeo_question_evidence e3 WHERE e3.question_id = q.id) AS answer_words,
              (SELECT GROUP_CONCAT(DISTINCT e4.model)
                 FROM aeo_question_evidence e4 WHERE e4.question_id = q.id) AS models,
              CASE WHEN q.standing_answer IS NULL THEN 0 ELSE 1 END AS has_draft,
              q.answer_approved_at, q.contested
         FROM aeo_question_evidence e JOIN aeo_questions q ON q.id = e.question_id
        WHERE e.user_id = ?
        ORDER BY evidence_count DESC`,
      [userId],
    ).catch(() => []);
    const lRows = await all<{ piece_id: string; verbatim_text: string }>(
      db,
      `SELECT p.id AS piece_id, q.verbatim_text, p.lede_approved_at AS approved_at
         FROM pieces p JOIN quotes q ON q.id = p.lede_quote_id
        WHERE p.user_id = ?`,
      [userId],
    ).catch(() => []);
    for (const r of lRows) ledeByPiece.set(r.piece_id, r.verbatim_text);
    for (const r of fRows) findingsByPiece.set(r.piece_id, Number(r.n) || 0);
    for (const r of qRows) {
      const cur = questionsByPiece.get(r.piece_id) ?? [];
      cur.push(questionView(r));
      questionsByPiece.set(r.piece_id, cur);
    }
  }

  // The ingestion receipt, per document. Computed on view — nothing caches it.
  const receipts = operator
    ? await (await import("../../graph/lib/ingestion-receipt"))
        .ingestionReceipts(db, userId)
        .catch(() => new Map<string, IngestionReceipt>())
    : new Map<string, IngestionReceipt>();

  // The corpus-wide worklist: every lead, newest first, capped so the page
  // stays a page. Readings sit in the same list as what the record noticed.
  let worklistLeads: Lead[] = [];
  let resurfaced: ResurfacedPassage | null = null;
  if (operator) {
    resurfaced = await (await import("../../lib/resurface"))
      .resurfacePassage(db, userId)
      .catch(() => null);
    const [leads, readings] = await Promise.all([
      (await import("../../graph/lib/leads"))
        .leadsForCorpus(db, userId, { limit: 30 })
        .catch(() => [] as Lead[]),
      (await import("../../lib/readings"))
        .readingsAsLeads(db, userId, { limit: 20 })
        .catch(() => [] as Lead[]),
    ]);
    worklistLeads = [...leads, ...readings].sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    );
  }

  // Stored answers for whatever leads those receipts carry, one query.
  const leadKeys = [...[...receipts.values()].flatMap((r) => r.leads), ...worklistLeads]
    .map((l) => l.answer_key)
    .filter((k): k is string => !!k);
  const leadAnswers =
    operator && leadKeys.length
      ? await (await import("../../graph/lib/answer-lead"))
          .answersForLeads(db, userId, leadKeys)
          .catch(() => new Map<string, LeadAnswer>())
      : new Map<string, LeadAnswer>();

  // CONSOLIDATION, per processed row, and LINEAGE for the tree.
  const doneIds = [...procRows.values()].filter((r) => r.status === "done").map((r) => r.piece_id);
  const consolidation =
    operator && doneIds.length
      ? await consolidationSummaries(db, userId, doneIds).catch(
          () => new Map<string, ConsolidationSummary>(),
        )
      : new Map<string, ConsolidationSummary>();
  const lineage = operator
    ? await lineageForPieces(db, userId).catch(() => new Map<string, Lineage>())
    : new Map<string, Lineage>();

  // WORKING TITLES. Candidates are computed here rather than stored, for the
  // handful of rows that need them; bodies are fetched for those alone.
  const flagged = operator
    ? pieces.filter((p) => !p.title_auto_at && looksLikeWorkingTitle(p.title)).slice(0, 12)
    : [];
  const candidatesByPiece = new Map<string, string[]>();
  if (flagged.length) {
    const placeholders = flagged.map(() => "?").join(",");
    const bodies = await all<{ id: string; body_md: string | null }>(
      db,
      `SELECT id, body_md FROM pieces WHERE user_id = ? AND id IN (${placeholders})`,
      [userId, ...flagged.map((p) => p.id)],
    ).catch(() => []);
    for (const b of bodies) {
      const cands = titleCandidates(b.body_md ?? "");
      if (cands.length) candidatesByPiece.set(b.id, cands);
    }
  }

  // Questions these documents answer — an index, not a worklist (see
  // graph/lib/standing-answer.ts openQuestions for why).
  const { openQuestions } = await import("../../graph/lib/standing-answer");
  const open = operator ? await openQuestions(db, userId, 12).catch(() => []) : [];

  const rows: LibraryRowModel[] = pieces.map((p) => {
    const isOnDemandDraft = p.publication_status === "working-material" && onDemandDrafts.has(p.id);
    const isPublished =
      p.publication_status === "published" || p.publication_status === "canonical";
    const chip = isOnDemandDraft
      ? "draft — awaiting review"
      : p.publication_status === "working-material"
        ? "working material"
        : operator
          ? null
          : "published";
    const href = isOnDemandDraft
      ? `/op/library/research/${p.id}/review`
      : p.publication_status === "working-material"
        ? null
        : `/library/${p.slug}`;
    const isRawFilename = looksLikeMachineFilename(p.title);
    const proc = procRows.get(p.id);
    const receipt = receipts.get(p.id);
    const lin = lineageView(lineage.get(p.id));
    const workingTitle: LibraryRowModel["workingTitle"] = !operator
      ? null
      : p.title_auto_at
        ? { original: p.original_title ?? null, candidates: [] }
        : candidatesByPiece.has(p.id)
          ? { original: null, candidates: candidatesByPiece.get(p.id) ?? [] }
          : null;
    return {
      id: p.id,
      slug: p.slug,
      title: isRawFilename ? "Untitled research document" : p.title,
      rawFilename: isRawFilename ? p.title : null,
      href,
      kind: p.kind,
      kindLabel: kindLabel(p.kind),
      publicationStatus: p.publication_status,
      chip,
      isOnDemandDraft,
      isPublished,
      date: p.published_at ?? null,
      updatedAt: proc?.updated_at ?? null,
      status: statusView(proc),
      receipt: operator ? receiptView(receipt) : null,
      workingTitle,
      lineage: lin,
      branches: lin?.branches ?? 0,
      leads: operator ? (receipt?.leads ?? []).map((l) => leadView(l, leadAnswers)) : [],
      consolidation:
        operator && proc?.status === "done" ? consolidationView(consolidation.get(p.id)) : null,
      findings: findingsByPiece.get(p.id) ?? 0,
      questions: questionsByPiece.get(p.id) ?? [],
      leadPassage: ledeByPiece.get(p.id) ?? null,
      essayLint: lintNotes(p.metadata),
      actions: operator && isPublished ? rowActions(p.id, proc) : [],
    };
  });

  // THE POST-UPLOAD BANNER: the ids the redirect carried, in order, capped,
  // and only the ones the library actually holds.
  const uploadedIds = opts.uploaded
    ? opts.uploaded
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
        .slice(0, UPLOAD_BANNER_MAX)
    : [];
  const byId = new Map(rows.map((r) => [r.id, r]));
  const uploaded: LibraryUploaded[] = operator
    ? uploadedIds
        .map((id) => byId.get(id))
        .filter((r): r is LibraryRowModel => !!r)
        .map((r) => {
          const done = r.status.state === "done";
          return {
            id: r.id,
            slug: r.slug,
            title: r.title,
            status: r.status,
            consolidation: done ? r.consolidation : null,
            leads: done ? r.leads : [],
          };
        })
    : [];

  const inUse = modelInUse(env);
  return {
    operator,
    model: {
      provider: inUse.provider,
      name: inUse.label,
      gatewayConfigured: inUse.configured,
      note: inUse.configured ? null : "gateway not configured",
    },
    counts: {
      documents: pieces.length,
      queued: procCounts.queued,
      processing: procCounts.running,
      failed: procCounts.failed,
      done: procCounts.done,
      unprocessed: procCounts.unprocessed,
      active: procCounts.queued + procCounts.running,
    },
    notice: noticeFor(opts),
    uploaded,
    resurfaced: resurfacedView(resurfaced),
    rows,
    worklist: worklistLeads.map((l) => leadView(l, leadAnswers)),
    answered: open.map((q) => ({
      id: q.id,
      question: q.question,
      sources: q.sources,
      evidenceCount: q.evidence_count,
      hasDraft: Boolean(q.has_draft),
    })),
    research: { href: "/op/research" },
    maintenance: {
      processEverything: { count: procCounts.unprocessed },
      advanceResearch: true,
    },
    importing: opts.importing ?? null,
    videoError: opts.videoError ?? null,
  };
}
