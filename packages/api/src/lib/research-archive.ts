// The research archive — every uploaded report, as markdown, in one zip.
//
// The operator asked for "all the research reports uploaded to the system" as
// a downloadable archive of the .md files. The text lives only in the live D1,
// so this is the one way out that does not go through fifty-two separate
// requests.
//
// Pure on purpose: it takes rows and returns bytes, so the part that can go
// wrong quietly — filenames, collisions, front matter — is testable without a
// database or a Worker.
//
// WHAT IS AND IS NOT ADDED TO A DOCUMENT
//
// Each file is the document's own body_md, untouched, under a small front-matter
// block saying where it came from. The body is never rewritten: this is an
// export of what was uploaded, and a version that had been tidied on the way out
// would be a second, silently different copy of the record (standing rule 3).
// The front matter is the only addition and it is the system's metadata, not
// the document's text. INDEX.md lists everything, so an archive of fifty files
// can be navigated before any of them is opened.

import { zipSync } from "fflate";

export interface ArchivePiece {
  slug: string;
  title: string;
  body_md: string | null;
  published_at: string | null;
  publication_status: string;
}

const SITE = "https://canopticon.com";

/** Safe as a filename on every platform, and still readable. */
export function archiveFilename(slug: string, taken: Set<string>): string {
  const base =
    slug
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      // Dot runs and leading dots: ".." is harmless once the slashes are gone,
      // but a leading dot makes a hidden file on macOS and Linux, so a document
      // would vanish from the folder view it was just extracted into.
      .replace(/\.{2,}/g, ".")
      .replace(/^[-.]+|[-.]+$/g, "")
      .slice(0, 120) || "untitled";
  // Two slugs that sanitise to the same name must not overwrite each other:
  // a zip with a duplicate path silently keeps one of them.
  let name = `${base}.md`;
  for (let n = 2; taken.has(name); n++) name = `${base}-${n}.md`;
  taken.add(name);
  return name;
}

/** A YAML double-quoted scalar. JSON string syntax is valid YAML, so titles
 *  carrying quotes or colons cannot break the block. */
const q = (s: string) => JSON.stringify(s);

export function frontMatter(p: ArchivePiece): string {
  const chars = (p.body_md ?? "").length;
  return [
    "---",
    `title: ${q(p.title)}`,
    `slug: ${q(p.slug)}`,
    `url: ${q(`${SITE}/p/${p.slug}`)}`,
    `status: ${q(p.publication_status)}`,
    `published: ${q(p.published_at ?? "unknown")}`,
    `characters: ${chars}`,
    "---",
    "",
  ].join("\n");
}

/**
 * The most files any one zip may carry, INDEX.md included.
 *
 * Claude Design reads about twenty files out of a zip and silently drops the
 * rest — a 53-file archive (52 reports and the index) arrived as roughly the
 * first twenty, with nothing to say the others had been cut. Fifteen documents
 * plus an index is sixteen files, under that with room to spare.
 */
export const MAX_DOCS_PER_ZIP = 15;

/**
 * How many documents go in each part: as few parts as the cap allows, then
 * dealt out as evenly as possible. 52 documents come out as 13/13/13/13 rather
 * than 15/15/15/7, because a part of seven is a download that looks like a
 * mistake.
 */
export function planParts(count: number, max = MAX_DOCS_PER_ZIP): number[] {
  if (count <= 0) return [];
  const parts = Math.ceil(count / max);
  const base = Math.floor(count / parts);
  const extra = count % parts;
  return Array.from({ length: parts }, (_, i) => base + (i < extra ? 1 : 0));
}

/**
 * Split documents into the parts the download offers.
 *
 * Documents with no body are dropped BEFORE splitting, so the parts are even
 * and a skipped document cannot shift which part a later one lands in. Order
 * is preserved, so part N holds the same documents on every request for as
 * long as the corpus does not change.
 */
export function archiveParts(
  pieces: ArchivePiece[],
  max = MAX_DOCS_PER_ZIP,
): { parts: ArchivePiece[][]; skipped: number } {
  const usable = pieces.filter((p) => p.body_md?.trim());
  const sizes = planParts(usable.length, max);
  const parts: ArchivePiece[][] = [];
  let at = 0;
  for (const size of sizes) {
    parts.push(usable.slice(at, at + size));
    at += size;
  }
  return { parts, skipped: pieces.length - usable.length };
}

/** Where a part sits in the whole, for its INDEX.md. */
export interface PartMeta {
  part: number;
  parts: number;
  /** 1-based position of this part's first document in the whole corpus. */
  first: number;
  /** Documents across every part. */
  total: number;
}

export function buildIndex(
  entries: Array<{ file: string; piece: ArchivePiece }>,
  meta?: PartMeta,
): string {
  const total = entries.reduce((n, e) => n + (e.piece.body_md ?? "").length, 0);
  const lines = [
    "# Canopticon — research archive",
    "",
    ...(meta
      ? [
          `**Part ${meta.part} of ${meta.parts}** — documents ${meta.first}–${
            meta.first + entries.length - 1
          } of ${meta.total}. The other parts hold the rest.`,
          "",
        ]
      : []),
    `${entries.length} documents, ${total.toLocaleString("en-US")} characters.`,
    "",
    "Each file is the document exactly as uploaded, under a short front-matter block",
    "recording its title, address, status and date. The body is never edited.",
    "",
  ];
  for (const { file, piece } of entries) {
    const chars = (piece.body_md ?? "").length;
    lines.push(
      `- [${piece.title.replace(/[[\]]/g, "")}](${file}) — ${chars.toLocaleString("en-US")} characters`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

/**
 * Build the zip. Returns the bytes and what went in, so a caller can report
 * the count rather than assume it.
 *
 * A piece with no body is skipped and counted, not written as an empty file:
 * an empty .md in an archive looks like a document and is not one.
 */
export function buildArchive(
  pieces: ArchivePiece[],
  meta?: PartMeta,
): {
  bytes: Uint8Array;
  included: number;
  skipped: number;
} {
  const enc = new TextEncoder();
  const taken = new Set<string>(["INDEX.md"]);
  const files: Record<string, [Uint8Array, { mtime: Date }]> = {};
  const entries: Array<{ file: string; piece: ArchivePiece }> = [];
  let skipped = 0;

  for (const piece of pieces) {
    if (!piece.body_md?.trim()) {
      skipped++;
      continue;
    }
    const file = archiveFilename(piece.slug, taken);
    const when = piece.published_at ? new Date(piece.published_at) : new Date();
    files[file] = [
      enc.encode(frontMatter(piece) + piece.body_md),
      { mtime: Number.isNaN(when.getTime()) ? new Date() : when },
    ];
    entries.push({ file, piece });
  }

  files["INDEX.md"] = [enc.encode(buildIndex(entries, meta)), { mtime: new Date() }];

  // Level 1: markdown compresses well at any level, and this runs inside a
  // Worker request where CPU time is the scarce thing, not bytes.
  return { bytes: zipSync(files, { level: 1 }), included: entries.length, skipped };
}
