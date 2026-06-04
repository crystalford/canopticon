// Synthesis — oversight of system-surfaced findings.
//
// Read-only. The system surfaces; the operator reads. Only the "Use in
// Studio →" hand-off acts on a card — no approve, no verify-each, no
// Watch/Nudge/Dismiss. Silence is valid (handoff: "the operator should
// be able to ignore the console for days").
//
// Data: the `patterns` table holds finding candidates produced by the
// surfacer (graph/lib/synthesis-surfacer.ts). Status 'candidate' is the
// triage queue; 'signed' renders as a confirmed pattern (P4 public
// surface). 'dismissed' stays in history but won't show here.

import { renderMarkdown } from "../../cms/lib/render-post";
import { all } from "../../lib/d1";
import { escapeAttr, escapeHtml } from "../../public/layout";
import { resolveOperatorId } from "../data";
import { emptyState, icon, lensToggle, renderOpPage } from "../layout";

interface PatternRow {
  id: string;
  slug: string;
  kind: string;
  title: string;
  statement_md: string;
  confidence: string;
  status: string;
  disconfirming_md: string;
  date_range_from: string | null;
  date_range_to: string | null;
  updated_at: string;
  piece_count: number;
  entity_count: number;
}

interface CorpusGroup {
  chain_id: string | null;
  pieces: Array<{
    slug: string;
    title: string;
    kind: string;
    publication_status: string;
    claim_count: number;
  }>;
}

const KIND_BADGE: Record<string, { cls: string; label: string }> = {
  "recurring-actor": { cls: "b-pattern", label: "Pattern" },
  pattern: { cls: "b-pattern", label: "Pattern" },
  contradiction: { cls: "b-contradiction", label: "Contradiction" },
  connection: { cls: "b-connection", label: "Connection" },
  gap: { cls: "b-gap", label: "Gap" },
  thesis: { cls: "b-thesis", label: "Thesis candidate" },
  frame: { cls: "b-pattern", label: "Frame" },
  "rules-for-thee": { cls: "b-pattern", label: "Pattern" },
  measurement: { cls: "b-pattern", label: "Pattern" },
  "net-zero": { cls: "b-pattern", label: "Pattern" },
  other: { cls: "b-pattern", label: "Pattern" },
};

function cardTypeClass(kind: string): string {
  if (kind === "recurring-actor" || kind === "frame" || kind === "pattern") return "t-pattern";
  if (kind === "contradiction") return "t-contradiction";
  if (kind === "connection") return "t-connection";
  if (kind === "thesis") return "t-thesis";
  return "t-pattern";
}

async function loadFindings(db: D1Database, userId: string): Promise<PatternRow[]> {
  return all<PatternRow>(
    db,
    `SELECT p.id, p.slug, p.kind, p.title, p.statement_md, p.confidence,
            p.status, p.disconfirming_md, p.date_range_from, p.date_range_to,
            p.updated_at,
            (SELECT COUNT(*) FROM pattern_pieces pp WHERE pp.pattern_id = p.id) AS piece_count,
            (SELECT COUNT(*) FROM pattern_entities pe WHERE pe.pattern_id = p.id) AS entity_count
       FROM patterns p
      WHERE p.user_id = ? AND p.status != 'dismissed'
      ORDER BY (CASE WHEN p.signed_at IS NULL THEN 0 ELSE 1 END),
               p.updated_at DESC
      LIMIT 60`,
    [userId],
  );
}

async function loadCorpus(db: D1Database, userId: string): Promise<CorpusGroup[]> {
  const rows = await all<{
    slug: string;
    title: string;
    kind: string;
    publication_status: string;
    chain_id: string | null;
    claim_count: number;
  }>(
    db,
    `SELECT p.slug, p.title, p.kind, p.publication_status, p.chain_id,
            (SELECT COUNT(*) FROM claims c WHERE c.asserted_in_piece_id = p.id) AS claim_count
       FROM pieces p
      WHERE p.user_id = ?
      ORDER BY p.publication_status NOT IN ('published','canonical'),
               p.chain_id IS NULL,
               p.chain_id,
               COALESCE(p.published_at, p.updated_at) DESC
      LIMIT 200`,
    [userId],
  );
  // Group by chain_id with a synthetic 'published-canonical' group at top.
  const grouped: CorpusGroup[] = [];
  const byChain = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = r.chain_id ?? "_standalone";
    const list = byChain.get(key) ?? [];
    list.push(r);
    byChain.set(key, list);
  }
  for (const [key, pieces] of byChain.entries()) {
    grouped.push({ chain_id: key === "_standalone" ? null : key, pieces });
  }
  return grouped;
}

async function loadCounts(db: D1Database, userId: string): Promise<Record<string, number>> {
  const rows = await all<{ kind: string; n: number }>(
    db,
    `SELECT kind, COUNT(*) AS n FROM patterns
      WHERE user_id = ? AND status != 'dismissed'
      GROUP BY kind`,
    [userId],
  );
  const out: Record<string, number> = { all: 0 };
  let total = 0;
  for (const r of rows) {
    out[r.kind] = r.n;
    total += r.n;
  }
  out.all = total;
  return out;
}

// Collapse the raw pattern kinds into the five chip buckets.
function kindBucket(kind: string): string {
  if (kind === "contradiction") return "contradiction";
  if (kind === "connection") return "connection";
  if (kind === "gap") return "gap";
  return "pattern"; // recurring-actor, frame, thesis, pattern, etc.
}

function findingCard(p: PatternRow): string {
  const badge = KIND_BADGE[p.kind] ?? KIND_BADGE.pattern;
  if (!badge) return "";
  const dateRange =
    p.date_range_from || p.date_range_to
      ? ` · ${p.date_range_from?.slice(0, 7) ?? "—"} to ${p.date_range_to?.slice(0, 7) ?? "—"}`
      : "";
  const restsLine = `<div class="card-rests"><span class="rk">rests on</span> <span class="rd">${p.piece_count} piece${p.piece_count === 1 ? "" : "s"}</span> · <span class="rd">${p.entity_count} entit${p.entity_count === 1 ? "y" : "ies"}</span></div>`;
  const isSigned = p.status === "signed";
  const useInStudioLabel = isSigned ? "Used in Studio" : "Use in Studio →";
  return `<div class="card ${cardTypeClass(p.kind)}${isSigned ? " promoted" : ""}" data-bucket="${escapeAttr(kindBucket(p.kind))}">
  <div class="card-head">
    <span class="badge ${badge.cls}">${escapeHtml(badge.label)}</span>
    <span class="card-meta">${escapeHtml(p.confidence)} confidence${dateRange}</span>
    <span class="card-count">${p.piece_count} pcs</span>
  </div>
  <div class="card-body">
    <div class="card-title">${escapeHtml(p.title)}</div>
    <div class="card-desc">${renderMarkdown(p.statement_md.slice(0, 480))}${p.statement_md.length > 480 ? "…" : ""}</div>
    ${restsLine}
    <div class="verbs">
      <a class="verb verb-studio${isSigned ? " done" : ""}" href="/op/studio?source=${escapeAttr(p.id)}">
        ${icon("spark")}
        ${useInStudioLabel}
      </a>
    </div>
  </div>
</div>`;
}

function gapCard(p: PatternRow): string {
  return `<div class="card-gap" data-bucket="gap">
  <span class="badge b-gap">Gap</span>
  <span class="gtext">${escapeHtml(p.title)} — ${renderMarkdown(p.statement_md.slice(0, 240))}${p.statement_md.length > 240 ? "…" : ""}</span>
</div>`;
}

function findingsBody(findings: PatternRow[], counts: Record<string, number>): string {
  const filterCount = (key: string) => counts[key] ?? 0;
  const filters = `<div class="filters">
  <button class="fchip on" data-filter="all"><span class="fcdot" style="background:var(--mute)"></span>All <span class="fccount">${filterCount("all")}</span></button>
  <button class="fchip" data-filter="pattern"><span class="fcdot" style="background:var(--c-pattern)"></span>Pattern <span class="fccount">${filterCount("recurring-actor")}</span></button>
  <button class="fchip" data-filter="contradiction"><span class="fcdot" style="background:var(--c-contra)"></span>Contradiction <span class="fccount">${filterCount("contradiction")}</span></button>
  <button class="fchip" data-filter="connection"><span class="fcdot" style="background:var(--c-connect)"></span>Connection <span class="fccount">${filterCount("connection")}</span></button>
  <button class="fchip" data-filter="gap"><span class="fcdot" style="background:var(--c-gap)"></span>Gap <span class="fccount">${filterCount("gap")}</span></button>
</div>`;

  if (findings.length === 0) {
    return `${filters}
${emptyState({
  iconName: "synthesis",
  title: "No findings yet.",
  body: "Drop documents in Feed to grow the graph. Findings will surface here when entities recur across investigations, when entity pairs co-occur, or when a subject has many investigations but no grounded claims.",
  action: { href: "/op", label: "Open Feed" },
})}`;
  }

  const cards = findings.map((f) => (f.kind === "gap" ? gapCard(f) : findingCard(f))).join("");

  return `${filters}<div class="cards">${cards}</div>${FINDINGS_FILTER_JS}`;
}

// Client-side bucket filter for the findings chips — all cards are rendered;
// chips toggle visibility by data-bucket.
const FINDINGS_FILTER_JS = `<script>
(function () {
  var chips = document.querySelectorAll(".filters .fchip");
  var cards = document.querySelectorAll(".cards [data-bucket]");
  chips.forEach(function (c) {
    c.addEventListener("click", function () {
      chips.forEach(function (x) { x.classList.remove("on"); });
      c.classList.add("on");
      var f = c.dataset.filter || "all";
      cards.forEach(function (card) {
        card.style.display = (f === "all" || card.dataset.bucket === f) ? "" : "none";
      });
    });
  });
})();
</script>`;

function corpusBody(groups: CorpusGroup[]): string {
  if (groups.length === 0) {
    return emptyState({
      iconName: "library",
      title: "No documents to view.",
      body: "Drop research reports in Feed. The Corpus lens shows them grouped by chain with claim counts.",
      action: { href: "/op", label: "Open Feed" },
    });
  }
  const sections: string[] = [];
  const publishedGroup = groups.flatMap((g) =>
    g.pieces.filter(
      (p) => p.publication_status === "published" || p.publication_status === "canonical",
    ),
  );
  if (publishedGroup.length > 0) {
    sections.push(
      `<div class="corpus-group-h">Published · canonical <span class="cgcount">${publishedGroup.length} doc${publishedGroup.length === 1 ? "" : "s"}</span></div>`,
    );
    for (const p of publishedGroup) {
      sections.push(corpusRow(p));
    }
  }
  sections.push(
    `<div class="corpus-group-h">Working material <span class="cgcount">grouped by chain</span></div>`,
  );
  for (const g of groups) {
    const working = g.pieces.filter((p) => p.publication_status === "working-material");
    if (working.length === 0) continue;
    if (g.chain_id) {
      sections.push(
        `<div class="corpus-chain-h"><span class="cch-arrow">↳</span><span class="cch-name">${escapeHtml(g.chain_id)}</span><span class="cch-count">${working.length} doc${working.length === 1 ? "" : "s"}</span></div>`,
      );
    }
    for (const p of working) {
      sections.push(corpusRow(p, !!g.chain_id));
    }
  }
  return `<div class="corpus">${sections.join("")}</div>`;
}

function corpusRow(
  p: { slug: string; title: string; kind: string; publication_status: string; claim_count: number },
  indented = false,
): string {
  const isPub = p.publication_status === "published" || p.publication_status === "canonical";
  return `<a class="crow${indented ? " indented" : ""}" href="/op/library/${escapeAttr(p.slug)}">
  <span class="cstatus ${isPub ? "published" : "working"}"></span>
  <span class="cname">${escapeHtml(p.title || p.slug)}</span>
  <span class="cstat-lbl ${isPub ? "published" : "working"}">${escapeHtml(p.publication_status)}</span>
  <span class="cclaims">${p.claim_count} claims</span>
  <span class="mono crow-arrow">→</span>
</a>`;
}

export async function renderSynthesisScreen(
  env: { DB: D1Database },
  view: "findings" | "corpus" = "findings",
): Promise<string> {
  const userId = await resolveOperatorId(env.DB);

  const topbarActions = `${lensToggle([
    { label: "Findings", href: "/op/synthesis", active: view === "findings" },
    { label: "Corpus", href: "/op/synthesis?view=corpus", active: view === "corpus" },
  ])}
  <form method="POST" action="/op/synthesis/surface" style="display:inline;margin-left:8px">
    <button class="btn" type="submit" title="Re-run the synthesis surfacer over the corpus">${icon("spark")} Re-surface</button>
  </form>`;

  let body: string;
  if (!userId) {
    body = emptyState({
      iconName: "synthesis",
      title: "No operator yet.",
      body: "Run the deploy workflow to seed.",
    });
  } else if (view === "findings") {
    const [findings, counts] = await Promise.all([
      loadFindings(env.DB, userId),
      loadCounts(env.DB, userId),
    ]);
    body = findingsBody(findings, counts);
  } else {
    const groups = await loadCorpus(env.DB, userId);
    body = corpusBody(groups);
  }

  return renderOpPage({
    title: "Synthesis",
    sub: "oversight · the system surfaces; you read",
    topbarActions,
    body,
    activeNav: "/op/synthesis",
  });
}
