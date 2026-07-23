// POST /segments/from-reading — server-to-server intake for a reading-
// sourced video essay. Called by the publication's api Worker (not a
// browser — no session cookie), so this is gated by a shared token
// instead of requireOperator(). Drafts a §7b Segment from the supplied
// reading content, inserts it as 'awaiting_approval', and returns the
// review URL the caller redirects the operator's browser to — from
// there it's the exact same /queue/:id review + approve + render flow
// the GDELT pipeline already uses (see queue.ts's "reading-" branch).

import { Hono } from "hono";
import { draftSegmentFromReading } from "../editorial/reading-brain";
import type { Env } from "../env";
import { insertDraftedSegment } from "../storage/d1";

const app = new Hono<{ Bindings: Env }>();

interface FromReadingBody {
  subjectSlug?: unknown;
  subjectLabel?: unknown;
  thesis?: unknown;
  facts?: unknown;
  format?: unknown;
}

app.post("/from-reading", async (c) => {
  if (!c.env.VIDEO_INTERNAL_TOKEN) {
    return c.json({ ok: false, error: "VIDEO_INTERNAL_TOKEN not configured" }, 503);
  }
  const token = c.req.header("x-internal-token");
  if (token !== c.env.VIDEO_INTERNAL_TOKEN) {
    return c.json({ ok: false, error: "unauthorized" }, 401);
  }

  const body = (await c.req.json().catch(() => null)) as FromReadingBody | null;
  if (!body) return c.json({ ok: false, error: "invalid JSON body" }, 400);

  const subjectSlug = String(body.subjectSlug ?? "").trim();
  const subjectLabel = String(body.subjectLabel ?? "").trim();
  const thesis = String(body.thesis ?? "").trim();
  const format = body.format === "long" ? "long" : "short";
  const facts = Array.isArray(body.facts)
    ? (body.facts as unknown[])
        .map((f) => {
          const row = f as { text?: unknown; quote?: unknown; source?: unknown };
          return {
            text: String(row.text ?? "").trim(),
            quote: row.quote ? String(row.quote) : null,
            source: row.source ? String(row.source) : null,
          };
        })
        .filter((f) => f.text.length > 0)
    : [];

  if (!subjectSlug || !subjectLabel || !thesis) {
    return c.json({ ok: false, error: "missing subjectSlug, subjectLabel, or thesis" }, 400);
  }
  if (facts.length === 0) {
    return c.json({ ok: false, error: "no established facts supplied" }, 400);
  }

  const draft = await draftSegmentFromReading(
    { AI: c.env.AI },
    { subjectSlug, subjectLabel, thesis, facts },
    format,
  );
  if (!draft.ok || !draft.segment) {
    return c.json({ ok: false, error: draft.error ?? "draft failed" }, 500);
  }

  await insertDraftedSegment(c.env.DB, draft.segment, { sourceKind: "reading", subjectSlug });

  // candId strips the "seg-" prefix draftSegmentFromReading's skeleton
  // and LLM path both put on segment.id — /queue/:id expects a bare
  // candidate id and prepends "seg-" itself (see queue.ts's synthetic
  // candidate branches).
  const candId = draft.segment.id.replace(/^seg-/, "");
  return c.json({
    ok: true,
    segmentId: draft.segment.id,
    usedLlm: draft.used_llm,
    reviewPath: `/queue/${encodeURIComponent(candId)}`,
  });
});

export default app;
