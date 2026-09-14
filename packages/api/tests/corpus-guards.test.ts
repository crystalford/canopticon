// The two guards that stand between the operator's own documents and ~100
// third-party pages the retired crawler banked as source material.
//
// Getting these wrong does not throw. It publishes Wikipedia articles and
// copyrighted news transcripts at canopticon.com as the operator's own work
// under CC BY 4.0, or it destroys documents that should have gone live. Both
// failures look like success from the inside, which is exactly why they are
// asserted here rather than left to a careful reading of the SQL.

import { describe, expect, it } from "vitest";
import { UNTITLED, displayTitle, looksLikeMachineFilename } from "../src/lib/title";

// Imported, not copied. A test asserting on its own duplicate of the SQL
// would keep passing after the real fragment drifted, which is the one thing
// these tests exist to prevent.
import { OWN_UPLOADS_SQL, WEB_FETCHED_SQL } from "../src/admin/runtime";

describe("corpus guards — SQL shape", () => {
  it("the publish filter names feed-upload AND excludes the web-fetched tag", () => {
    // Two independent conditions on purpose: ingested_from is the real
    // filter, the tag is the backstop if a future ingest path forgets to set
    // ingested_from.
    expect(OWN_UPLOADS_SQL).toContain("'feed-upload'");
    expect(OWN_UPLOADS_SQL).toContain("NOT LIKE '%web-fetched%'");
    expect(OWN_UPLOADS_SQL).not.toContain("record-expand");
  });

  it("the purge filter is the inverse and never matches feed-upload alone", () => {
    expect(WEB_FETCHED_SQL).toContain("'record-expand'");
    expect(WEB_FETCHED_SQL).toContain("LIKE '%web-fetched%'");
    expect(WEB_FETCHED_SQL).not.toContain("feed-upload");
  });

  it("tolerates a NULL tags column on the publish side", () => {
    // `NULL NOT LIKE '...'` is NULL in SQLite, not true — without the
    // explicit IS NULL branch, a piece with no tags would be silently
    // excluded from publishing and the operator's document would stay dark.
    expect(OWN_UPLOADS_SQL).toContain("tags IS NULL");
  });
});

// A tiny stand-in for the row shapes the two queries select over, so the
// intent of each guard is asserted against data rather than only strings.
type Row = { slug: string; ingested_from: string; tags: string | null };
const CORPUS: Row[] = [
  { slug: "my-research-report", ingested_from: "feed-upload", tags: null },
  { slug: "my-other-report", ingested_from: "feed-upload", tags: "[]" },
  { slug: "board-of-peace-wikipedia", ingested_from: "record-expand", tags: '["web-fetched"]' },
  { slug: "carney-davos-rev", ingested_from: "record-expand", tags: '["web-fetched"]' },
  // A piece the tag caught even though ingested_from was never set.
  { slug: "untagged-but-fetched", ingested_from: "", tags: '["web-fetched"]' },
];

const isOwnUpload = (r: Row) =>
  r.ingested_from === "feed-upload" && (r.tags === null || !r.tags.includes("web-fetched"));
const isWebFetched = (r: Row) =>
  r.ingested_from === "record-expand" || (r.tags?.includes("web-fetched") ?? false);

describe("corpus guards — the two populations never overlap", () => {
  it("publishes only the operator's own uploads", () => {
    expect(CORPUS.filter(isOwnUpload).map((r) => r.slug)).toEqual([
      "my-research-report",
      "my-other-report",
    ]);
  });

  it("purges only third-party material, including a piece caught by tag alone", () => {
    expect(CORPUS.filter(isWebFetched).map((r) => r.slug)).toEqual([
      "board-of-peace-wikipedia",
      "carney-davos-rev",
      "untagged-but-fetched",
    ]);
  });

  it("no piece is ever in both sets", () => {
    const both = CORPUS.filter((r) => isOwnUpload(r) && isWebFetched(r));
    expect(both, "a piece matched by both guards would be published AND deleted").toEqual([]);
  });

  it("every piece is classified, so nothing is silently stranded", () => {
    const neither = CORPUS.filter((r) => !isOwnUpload(r) && !isWebFetched(r));
    expect(neither).toEqual([]);
  });
});

describe("displayTitle", () => {
  it("keeps a title a person actually wrote", () => {
    expect(displayTitle("Mark Carney's Davos speech", "# something else")).toBe(
      "Mark Carney's Davos speech",
    );
  });

  it("recovers a heading when the stored title is an upload filename", () => {
    const raw = "compass_artifact_wf-c96cfa7c-3f5d-44e9-b01e-2aea6ad75f33_text_markdown.md";
    expect(looksLikeMachineFilename(raw)).toBe(true);
    expect(displayTitle(raw, "# The World Economic Forum\n\nBody text.")).toBe(
      "The World Economic Forum",
    );
  });

  it("falls back to the first non-empty line when there is no heading", () => {
    const raw = "3f2a1b88-0c4d-4e2a-report.pdf";
    expect(displayTitle(raw, "\n\nAn opening line with no heading.\n\nMore.")).toBe(
      "An opening line with no heading.",
    );
  });

  it("falls back to a readable placeholder rather than publishing the filename", () => {
    const raw = "a1b2c3d4-e5f6-7890-scan.pdf";
    expect(displayTitle(raw, "")).toBe(UNTITLED);
    expect(displayTitle(raw, null)).toBe(UNTITLED);
  });

  it("treats a short filename-ish title as human, since the risk is over-correcting", () => {
    // "notes.md" is 8 chars — under the length floor. Renaming a real title
    // is worse than leaving one odd one through.
    expect(looksLikeMachineFilename("notes.md")).toBe(false);
    expect(displayTitle("notes.md", "# Something")).toBe("notes.md");
  });

  it("never returns an empty title", () => {
    expect(displayTitle("", "")).toBe(UNTITLED);
  });
});
