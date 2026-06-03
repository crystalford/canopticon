// Build the canopticon-library bulk-ingest payload.
//
// Usage:
//   pnpm tsx scripts/build-library-payload.ts <path-to-canopticon-library.zip> [out.json]
//
// Reads the library zip (which contains 65 markdown reports + a
// library-manifest.json), assembles the payload, and writes it to
// out.json (or stdout if omitted). The operator then POSTs the
// resulting file to /v1/admin/ingest-library via:
//
//   curl -X POST https://canopticon.com/v1/admin/ingest-library \
//        -H 'content-type: application/json' \
//        -d @out.json
//
// No Node dependency on a zip lib: we shell out to `unzip -p` for each
// file inside the archive, which works on every dev box.

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

interface ManifestReport {
  id?: string;
  title: string;
  kind?: string;
  slug: string;
  word_count?: number;
  source_file: string;
  detected_entities?: string[];
}

interface Manifest {
  library: string;
  report_count: number;
  reports: ManifestReport[];
}

interface OutputReport {
  id?: string;
  slug: string;
  title: string;
  kind: string;
  body_md: string;
  word_count?: number;
  detected_entities?: string[];
}

const zipPath = process.argv[2];
const outPath = process.argv[3];

if (!zipPath) {
  console.error("usage: pnpm tsx scripts/build-library-payload.ts <library.zip> [out.json]");
  process.exit(2);
}

function readEntry(entry: string): string {
  return execFileSync("unzip", ["-p", zipPath as string, entry], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

const manifestRaw = readEntry("canopticon-library/library-manifest.json");
const manifest: Manifest = JSON.parse(manifestRaw);
console.error(`Reading ${manifest.report_count} reports from ${zipPath}`);

const reports: OutputReport[] = [];
for (const r of manifest.reports) {
  try {
    const body = readEntry(`canopticon-library/${r.source_file}`);
    const out: OutputReport = {
      slug: r.slug,
      title: r.title,
      kind: r.kind ?? "research-report",
      body_md: body,
    };
    if (r.id !== undefined) out.id = r.id;
    if (r.word_count !== undefined) out.word_count = r.word_count;
    if (r.detected_entities !== undefined) out.detected_entities = r.detected_entities;
    reports.push(out);
  } catch (err) {
    console.error(`  ! failed: ${r.slug} — ${(err as Error).message}`);
  }
}

const payload = { reports };
const json = JSON.stringify(payload, null, 2);

if (outPath) {
  writeFileSync(outPath, json);
  const totalKB = Math.round(json.length / 1024);
  console.error(`Wrote ${reports.length} reports to ${outPath} (${totalKB} KB).`);
} else {
  process.stdout.write(json);
  console.error(`Wrote ${reports.length} reports to stdout.`);
}
