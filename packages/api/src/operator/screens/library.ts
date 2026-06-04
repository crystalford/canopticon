// Library — the full document archive.
//
// Stats bar (live counts), search input (P3 wires the keyword filter),
// chain filter chips, and the bordered list with chain sub-headers
// + expandable detail rows. Per the design's §4 spec.

import { all } from "../../lib/d1";
import { escapeAttr, escapeHtml } from "../../public/layout";
import { resolveOperatorId } from "../data";
import { icon, renderOpPage } from "../layout";

interface PieceListRow {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  kind: string;
  publication_status: string;
  chain_id: string | null;
  byline: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  body_md: string | null;
  metadata: string | null;
  claim_count: number;
}

interface Stats {
  documents: number;
  claims: number;
  chains: number;
  published: number;
  working: number;
}

async function loadStats(db: D1Database, userId: string): Promise<Stats> {
  const scalar = async (sql: string, binds: unknown[]): Promise<number> => {
    const row = await db
      .prepare(sql)
      .bind(...binds)
      .first<{ n: number }>();
    return row?.n ?? 0;
  };
  const [documents, claims, chains, published, working] = await Promise.all([
    scalar("SELECT count(*) AS n FROM pieces WHERE user_id = ?", [userId]),
    scalar("SELECT count(*) AS n FROM claims WHERE user_id = ?", [userId]),
    scalar(
      "SELECT count(DISTINCT chain_id) AS n FROM pieces WHERE user_id = ? AND chain_id IS NOT NULL",
      [userId],
    ),
    scalar(
      "SELECT count(*) AS n FROM pieces WHERE user_id = ? AND publication_status IN ('published','canonical')",
      [userId],
    ),
    scalar(
      "SELECT count(*) AS n FROM pieces WHERE user_id = ? AND publication_status = 'working-material'",
      [userId],
    ),
  ]);
  return { documents, claims, chains, published, working };
}

async function loadDocuments(db: D1Database, userId: string): Promise<PieceListRow[]> {
  return all<PieceListRow>(
    db,
    `SELECT p.id, p.slug, p.title, p.subtitle, p.kind, p.publication_status,
            p.chain_id, p.byline, p.published_at, p.created_at, p.updated_at,
            p.body_md, p.metadata,
            (SELECT COUNT(*) FROM claims c WHERE c.asserted_in_piece_id = p.id) AS claim_count
       FROM pieces p
      WHERE p.user_id = ?
      ORDER BY p.chain_id IS NULL, p.chain_id, COALESCE(p.published_at, p.updated_at, p.created_at) DESC
      LIMIT 200`,
    [userId],
  );
}

function statusInfo(status: string): { cls: string; label: string } {
  if (status === "canonical") return { cls: "published", label: "canonical" };
  if (status === "published") return { cls: "published", label: "published" };
  return { cls: "working", label: "working" };
}

function relativeAge(iso: string | null): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  const sec = Math.round((Date.now() - t) / 1000);
  if (sec < 86_400) return `${Math.round(sec / 3600)}h`;
  return `${Math.round(sec / 86_400)}d`;
}

function pieceRow(p: PieceListRow): string {
  const s = statusInfo(p.publication_status);
  const titleOrSlug = p.title?.trim() || p.slug;
  return `<div class="lib-doc">
  <span class="lib-dot ${s.cls}"></span>
  <span class="lib-doc-name">${escapeHtml(titleOrSlug)}</span>
  <span class="lib-doc-kind">${escapeHtml(p.kind)}</span>
  <span class="lib-doc-status ${s.cls}">${escapeHtml(s.label)}</span>
  <span class="lib-doc-claims">${p.claim_count} claims</span>
  <span class="lib-doc-date">${escapeHtml(relativeAge(p.published_at ?? p.updated_at))}</span>
  <a href="/op/library/${escapeAttr(p.slug)}" class="mono" style="font-size:11px;color:var(--c-pattern);text-decoration:none">→</a>
</div>`;
}

function chainHeader(chainId: string, count: number, claimCount: number): string {
  return `<div class="lib-chain-hd">
  <span class="lch-arrow">↳</span>
  <span class="lch-name">${escapeHtml(chainId)}</span>
  <span class="lch-count">· ${count} doc${count === 1 ? "" : "s"}</span>
  <span class="lch-claims">${claimCount} claims</span>
</div>`;
}

export async function renderLibraryScreen(env: { DB: D1Database }): Promise<string> {
  const userId = await resolveOperatorId(env.DB);
  const stats = userId
    ? await loadStats(env.DB, userId)
    : { documents: 0, claims: 0, chains: 0, published: 0, working: 0 };
  const docs = userId ? await loadDocuments(env.DB, userId) : [];

  // Group by chain.
  const chained = new Map<string, PieceListRow[]>();
  const standalone: PieceListRow[] = [];
  for (const d of docs) {
    if (d.chain_id) {
      const list = chained.get(d.chain_id) ?? [];
      list.push(d);
      chained.set(d.chain_id, list);
    } else {
      standalone.push(d);
    }
  }

  const statsBar = `<div class="lib-stats">
  <div class="lib-stat"><div class="ls-n">${stats.documents}</div><div class="ls-l">Documents</div></div>
  <div class="lib-sep"></div>
  <div class="lib-stat"><div class="ls-n">${stats.claims}</div><div class="ls-l">Claims</div></div>
  <div class="lib-sep"></div>
  <div class="lib-stat"><div class="ls-n">${stats.chains}</div><div class="ls-l">Chains</div></div>
  <div class="lib-sep"></div>
  <div class="lib-stat"><div class="ls-n" style="color:var(--c-thesis)">${stats.published}</div><div class="ls-l">Published</div></div>
  <div class="lib-sep"></div>
  <div class="lib-stat"><div class="ls-n" style="color:var(--amber)">${stats.working}</div><div class="ls-l">Working</div></div>
</div>`;

  const search = `<div class="lib-search" style="margin-bottom:14px">
  ${icon("search")}
  <input class="lib-search-input" type="search" placeholder="Search documents, chains, entities…" disabled />
</div>`;

  const chainSlugs = [...chained.keys()].sort();
  const filterChips = `<div class="lib-filters" style="margin-bottom:16px">
  <button class="lib-fchip on">All <span class="mono" style="font-size:10px;color:var(--faint);margin-left:6px">${stats.documents}</span></button>
  <button class="lib-fchip">Published <span class="mono" style="font-size:10px;color:var(--faint);margin-left:6px">${stats.published}</span></button>
  <button class="lib-fchip">Working <span class="mono" style="font-size:10px;color:var(--faint);margin-left:6px">${stats.working}</span></button>
  ${chainSlugs
    .slice(0, 12)
    .map((chainId) => {
      const c = chained.get(chainId)?.length ?? 0;
      return `<button class="lib-fchip">${escapeHtml(chainId)} <span class="mono" style="font-size:10px;color:var(--faint);margin-left:6px">${c}</span></button>`;
    })
    .join("")}
</div>`;

  let listInner = "";
  for (const chainId of chainSlugs) {
    const group = chained.get(chainId) ?? [];
    const claimSum = group.reduce((s, p) => s + p.claim_count, 0);
    listInner += chainHeader(chainId, group.length, claimSum);
    listInner += group.map(pieceRow).join("");
  }
  if (standalone.length > 0 && chainSlugs.length > 0) {
    listInner += `<div class="lib-chain-hd"><span class="lch-arrow">↳</span><span class="lch-name">standalone</span><span class="lch-count">· ${standalone.length} doc${standalone.length === 1 ? "" : "s"}</span></div>`;
  }
  listInner += standalone.map(pieceRow).join("");

  const list = docs.length
    ? `<div class="lib-list">${listInner}</div>`
    : `<div class="lib-list"><div class="lib-empty">No documents in the archive yet. Drop research reports in Feed and they appear here as the digestion pipeline catalogues them.</div></div>`;

  const topbarActions = `<a href="/op" class="btn"><span style="display:inline-flex;align-items:center;gap:6px">${icon("upload")} Add document</span></a>`;

  return renderOpPage({
    title: "Library",
    sub: "the full document archive",
    topbarActions,
    body: `${statsBar}${search}${filterChips}${list}`,
    activeNav: "/op/library",
    width: "wide",
  });
}
