// The corpus has more than one population, and the schema cannot tell them
// apart. Every query that publishes, lists for the operator, extracts or
// deletes is guarded by one of these fragments — twice, on `ingested_from`
// and on a tag, so a row with one field wrong cannot slip through.
//
// Lives here, not in admin/runtime.ts, so a renderer can import a guard
// without pulling the admin router and everything it loads behind it.
// admin/runtime.ts re-exports them under the same names.

/** The operator's own uploads, never anything web-fetched. */
export const OWN_UPLOADS_SQL = `json_extract(metadata, '$.ingested_from') = 'feed-upload'
   AND (tags IS NULL OR tags NOT LIKE '%web-fetched%')`;

/**
 * The crawler's banked third-party pages. The crawler writes `sources` only
 * now (graph/lib/record-builder.ts, 2026-09-24); this matches what it left
 * behind before that, until the purge removes them.
 */
export const WEB_FETCHED_SQL = `(json_extract(metadata, '$.ingested_from') = 'record-expand'
    OR tags LIKE '%web-fetched%')`;

/**
 * The research pipeline's own output. Neither an upload nor a fetched page,
 * so neither guard above matches it; anything acting on it needs this one.
 */
export const DEEP_RESEARCH_SQL = `json_extract(metadata, '$.ingested_from') = 'deep-research'
   AND (tags IS NULL OR tags LIKE '%auto-research%')`;
