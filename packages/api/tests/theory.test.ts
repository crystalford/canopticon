// Theories: a named idea stated formally. The record's rules apply — every
// quotation checked word for word at build — and so does the form: a claim,
// graded propositions, and the seven sections, or the build fails.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseFrontMatter } from "../scripts/build-content.mjs";
import app from "../src/index";
import { allTheories, libraryItems } from "../src/site/content/store";

const env = { LOG_LEVEL: "error" };
const get = (path: string) => app.fetch(new Request(`http://test${path}`), env);

const SECTIONS = [
  "Definition",
  "Mechanism",
  "Evidence",
  "Measures",
  "Protocol",
  "Scope",
  "Counter-evidence",
];

describe("theories", () => {
  it("every theory has a claim, graded propositions and the seven sections", () => {
    expect(allTheories().length).toBeGreaterThan(0);
    for (const t of allTheories()) {
      expect(t.claim).toBeTruthy();
      expect(t.propositions.length).toBeGreaterThan(0);
      for (const p of t.propositions) expect(["Strong", "Moderate", "Proposed"]).toContain(p.grade);
      for (const s of SECTIONS) expect(t.body).toContain(`## ${s}\n`);
    }
  });

  it("the source file parses to the same propositions", () => {
    const { meta } = parseFrontMatter(
      readFileSync("content/theories/self-extinguishing-maintenance.md", "utf8"),
    );
    expect(Array.isArray(meta.propositions)).toBe(true);
    expect((meta.propositions as unknown[]).length).toBe(6);
  });

  it("renders the claim, the propositions with grades, receipts and a citation", async () => {
    const res = await get("/theories/self-extinguishing-maintenance");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('class="theory-card"');
    expect(html).toContain('id="propositions"');
    expect(html.match(/class="prop"/g)?.length).toBe(6);
    expect(html).toContain(">Strong<");
    expect(html).toContain('href="/p/when-healed-is-the-treatment-working');
    expect(html).toContain("Cite this");
    expect(html).toContain('"@type":"DefinedTerm"');
    expect(html).toContain("</footer>");
  });

  it("has a Markdown twin that leads with the claim and the propositions", async () => {
    const md = await (await get("/theories/self-extinguishing-maintenance.md")).text();
    expect(md).toContain("**Claim.**");
    expect(md).toContain("## Propositions");
    expect(md).toContain("(Strong)");
  });

  it("appears in the Library, and an unknown theory is not a page", async () => {
    expect(libraryItems().some((r) => r.kind === "Theory")).toBe(true);
    const lib = await (await get("/library?kind=Theory")).text();
    expect(lib).toContain("/theories/self-extinguishing-maintenance");
    expect((await get("/theories/nothing-here")).status).toBe(404);
  });

  it("the site calls itself a publication, not a notebook", async () => {
    const html = await (await get("/")).text();
    expect(html).toContain("An independent research publication by Chris Telford");
    expect(html).not.toContain("research and development notebook");
  });
});
