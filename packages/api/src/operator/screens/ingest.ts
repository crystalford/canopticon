import type { Env } from "../../env";
import { one } from "../../lib/d1";
import { resolveOperatorId } from "../../public/data";
import { escapeHtml } from "../../public/layout";
import { opHeader, renderOpPage } from "../layout";

interface DbStats {
  topics: number;
  entities: number;
  pieces: number;
  publishedPieces: number;
}

async function getStats(env: Env): Promise<DbStats> {
  const userId = await resolveOperatorId(env.DB);
  if (!userId) return { topics: 0, entities: 0, pieces: 0, publishedPieces: 0 };
  const [t, e, p, pub] = await Promise.all([
    one<{ c: number }>(env.DB, "SELECT count(*) as c FROM topics WHERE user_id = ?", [userId]),
    one<{ c: number }>(env.DB, "SELECT count(*) as c FROM entities WHERE user_id = ?", [userId]),
    one<{ c: number }>(env.DB, "SELECT count(*) as c FROM pieces WHERE user_id = ?", [userId]),
    one<{ c: number }>(
      env.DB,
      "SELECT count(*) as c FROM pieces WHERE user_id = ? AND publication_status IN ('published','canonical')",
      [userId],
    ),
  ]);
  return {
    topics: t?.c ?? 0,
    entities: e?.c ?? 0,
    pieces: p?.c ?? 0,
    publishedPieces: pub?.c ?? 0,
  };
}

export async function renderIngestScreen(
  env: Env,
  params: { result?: string | undefined; error?: string | undefined } = {},
): Promise<string> {
  const stats = await getStats(env);

  const resultBanner = params.result
    ? `<div style="margin-bottom:24px;padding:14px 18px;border-radius:var(--r);background:var(--confirmed-bg,rgba(34,197,94,.08));border:1px solid var(--confirmed-bd,rgba(34,197,94,.25));color:var(--ink);font-size:13.5px;white-space:pre-wrap;font-family:var(--mono)">${escapeHtml(params.result)}</div>`
    : "";

  const errorBanner = params.error
    ? `<div style="margin-bottom:24px;padding:14px 18px;border-radius:var(--r);background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.25);color:var(--correction,#ef4444);font-size:13.5px;font-family:var(--mono)">${escapeHtml(params.error)}</div>`
    : "";

  const statChip = (label: string, value: number) =>
    `<div style="display:flex;flex-direction:column;align-items:center;padding:12px 20px;border-radius:var(--r);background:var(--surface);border:1px solid var(--rule)">
      <span style="font-size:24px;font-weight:600;color:var(--ink);font-family:var(--mono)">${value}</span>
      <span style="font-size:11px;color:var(--ink-mute);text-transform:uppercase;letter-spacing:0.07em;margin-top:3px">${escapeHtml(label)}</span>
    </div>`;

  const body = `
${opHeader("Ingest", "populate the corpus")}
<div style="padding:28px 32px;max-width:720px">

  ${resultBanner}${errorBanner}

  <div style="display:flex;gap:12px;margin-bottom:32px">
    ${statChip("Topics", stats.topics)}
    ${statChip("Entities", stats.entities)}
    ${statChip("Pieces", stats.pieces)}
    ${statChip("Published", stats.publishedPieces)}
  </div>

  <section style="margin-bottom:36px">
    <h2 style="font-size:15px;font-weight:600;color:var(--ink);margin:0 0 6px">Initialize corpus</h2>
    <p style="font-size:13.5px;color:var(--ink-2);margin:0 0 16px;line-height:1.55">
      Seeds the structural skeleton: 3 topic hubs, 8 entities, and 5 canonical investigations
      (monetary-power, housing, capital-capture). Idempotent — safe to run again; existing rows
      are skipped unless you check Force.
    </p>
    <form method="POST" action="/op/ingest/seed" style="display:flex;gap:10px;align-items:center">
      <label style="display:flex;gap:6px;align-items:center;font-size:13px;color:var(--ink-2)">
        <input type="checkbox" name="force" value="1" style="accent-color:var(--accent)" />
        Force overwrite
      </label>
      <button type="submit" class="btn btn-primary" style="min-width:120px">Seed corpus</button>
    </form>
  </section>

  <section>
    <h2 style="font-size:15px;font-weight:600;color:var(--ink);margin:0 0 6px">Import library zip</h2>
    <p style="font-size:13.5px;color:var(--ink-2);margin:0 0 16px;line-height:1.55">
      Upload <code style="font-family:var(--mono);font-size:12.5px">canopticon-library.zip</code> to
      bulk-import the 65-report research corpus as working-material pieces. The Worker extracts the
      zip and ingests each report — no curl or scripts needed. Idempotent by slug.
    </p>
    <form method="POST" action="/op/ingest/library" enctype="multipart/form-data"
          style="display:flex;flex-direction:column;gap:12px"
          onsubmit="this.querySelector('button').textContent='Importing…';this.querySelector('button').disabled=true">
      <div style="display:flex;gap:10px;align-items:center">
        <input type="file" name="zip" accept=".zip" required
               style="flex:1;font-size:13.5px;color:var(--ink-2);background:var(--surface);border:1px solid var(--rule);border-radius:var(--r);padding:8px 12px" />
        <label style="display:flex;gap:6px;align-items:center;font-size:13px;color:var(--ink-2)">
          <input type="checkbox" name="force" value="1" style="accent-color:var(--accent)" />
          Force overwrite
        </label>
      </div>
      <div>
        <button type="submit" class="btn btn-primary" style="min-width:140px">Import zip</button>
      </div>
    </form>
  </section>

</div>`;

  return renderOpPage({ title: "Ingest", body, activeNav: "/op/ingest", fullBleed: true });
}
