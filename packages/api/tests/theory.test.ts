// Theories: a named idea stated formally. The record's rules apply — every
// quotation checked word for word at build — and so does the form: a claim,
// graded propositions, and the seven sections, or the build fails.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseFrontMatter } from "../scripts/build-content.mjs";
import app from "../src/index";
import { allTheories, libraryItems } from "../src/site/content/store";
import { doiChip } from "../src/site/pages/article";

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
      expect(t.body).toContain("## Prior work\n");
      expect(t.references.length).toBeGreaterThan(0);
      for (const p of t.propositions) {
        // The rubric, enforced: Strong rests on two studies, Moderate on one.
        const need = { Strong: 2, Moderate: 1, Proposed: 0 }[p.grade];
        expect(new Set(p.refs).size).toBeGreaterThanOrEqual(need);
        for (const r of p.refs) expect(t.references[r - 1]).toBeTruthy();
      }
    }
  });

  it("states the grading rubric, numbers the references and draws the loop", async () => {
    const html = await (await get("/theories/self-extinguishing-maintenance")).text();
    expect(html).toContain("How propositions are graded");
    expect(html).toContain("Measured directly in at least two independent studies");
    expect(html).toContain('id="references"');
    expect(html).toContain('id="ref-1"');
    expect(html).toContain('href="#ref-3"');
    expect(html).toContain('<figure class="cycle">');
    expect(html).toContain('role="img"');
    expect(html).toContain('"citation":[');
  });

  it("every theory opens with its short version, on the page and in the twin", async () => {
    for (const t of allTheories()) {
      expect(t.glance_words, t.slug).toBeTruthy();
      expect(t.glance_sentence, t.slug).toBeTruthy();
      const html = await (await get(`/theories/${t.slug}`)).text();
      expect(html).toContain('<section class="glance"');
      expect(html.indexOf('class="glance"')).toBeLessThan(html.indexOf('class="theory-card"'));
      const md = await (await get(`/theories/${t.slug}.md`)).text();
      expect(md).toContain("## At a glance");
    }
  });

  it("the source file parses to the same propositions", () => {
    const { meta } = parseFrontMatter(
      readFileSync("content/theories/self-extinguishing-maintenance.md", "utf8"),
    );
    expect(Array.isArray(meta.propositions)).toBe(true);
    expect((meta.propositions as unknown[]).length).toBe(8);
  });

  it("renders the claim, the propositions with grades, receipts and a citation", async () => {
    const res = await get("/theories/self-extinguishing-maintenance");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('class="theory-card"');
    expect(html).toContain('id="propositions"');
    expect(html.match(/class="prop"/g)?.length).toBe(8);
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
    expect(md).toContain("## References");
    expect(md).toContain("at least two independent studies");
  });

  it("appears in the Library, and an unknown theory is not a page", async () => {
    expect(libraryItems().some((r) => r.kind === "Theory")).toBe(true);
    const lib = await (await get("/library?kind=Theory")).text();
    expect(lib).toContain("/theories/self-extinguishing-maintenance");
    expect((await get("/theories/nothing-here")).status).toBe(404);
  });

  it("a second theory, its paper, and the two theories linking each other", async () => {
    const ce = await get("/theories/cognitive-ectothermy");
    expect(ce.status).toBe(200);
    const html = await ce.text();
    expect(html).toContain('href="/papers/why-temperature"');
    expect(html).toContain('href="/theories/self-extinguishing-maintenance"');
    expect(html).toContain("the cross marks where it can be cut");
    expect(html).not.toContain("checked word for word against the research document");
    const sem = await (await get("/theories/self-extinguishing-maintenance")).text();
    expect(sem).toContain('href="/theories/cognitive-ectothermy"');
    const paper = await get("/papers/why-temperature");
    expect(paper.status).toBe(200);
    const ptext = await paper.text();
    expect(ptext).toContain("cognitive ectothermy");
    // Outside the series, it builds on it, and names its theory.
    expect(ptext).toContain("Builds on");
    expect(ptext).toContain('href="/theories/cognitive-ectothermy"');
  });

  it("every reference says what was read, and the page says so", async () => {
    for (const t of allTheories())
      for (const r of t.references) expect(["full", "abstract", "secondary"]).toContain(r.read);
    const html = await (await get("/theories/self-extinguishing-maintenance")).text();
    expect(html).toContain("Read in full");
    expect(html).toContain("Cited from a secondary account");
    expect(html).toMatch(/\d+ in full, \d+ from the abstract, \d+ from a secondary account/);
  });

  it("the sitemap lists every theory, dated by its last revision", async () => {
    const xml = await (await get("/sitemap.xml")).text();
    for (const t of allTheories())
      expect(xml).toContain(
        `<loc>https://canopticon.com/theories/${t.slug}</loc><lastmod>${t.revised ?? t.date}</lastmod>`,
      );
  });

  it("/theories lists every theory as one set, with a Markdown twin", async () => {
    const res = await get("/theories");
    expect(res.status).toBe(200);
    const html = await res.text();
    for (const t of allTheories()) expect(html).toContain(`href="/theories/${t.slug}"`);
    expect(html).toContain('"@type":"DefinedTermSet"');
    expect(html).toContain('"hasDefinedTerm"');
    const md = await (await get("/theories.md")).text();
    expect(md).toContain("# Theories");
    // Each theory names the set it belongs to by the same @id.
    const one = await (await get("/theories/cognitive-ectothermy")).text();
    expect(one).toContain('"@id":"https://canopticon.com/theories#set"');
  });

  it("theories reach the feeds and llms-full.txt whole", async () => {
    const full = await (await get("/llms-full.txt")).text();
    const feed = await (await get("/feed.json")).text();
    for (const t of allTheories()) {
      expect(full).toContain(`# ${t.title} (theory)`);
      expect(feed).toContain(`/theories/${t.slug}`);
    }
    expect(full).toContain("## References");
  });

  it("every page names the author by one @id", async () => {
    for (const p of ["/", "/theories/self-extinguishing-maintenance", "/papers/why-temperature"])
      expect(await (await get(p)).text()).toContain('"@id":"https://canopticon.com/about#chris"');
  });

  it("hand-built papers carry Scholar's citation tags and their Markdown twin", async () => {
    const html = await (await get("/papers/krasis")).text();
    expect(html).toContain('name="citation_title"');
    expect(html).toContain('href="/papers/krasis.md"');
  });

  it("an article on the published literature counts its sources and names its theory", async () => {
    const html = await (await get("/articles/seeing-what-you-rely-on")).text();
    expect(html).toContain("13 sources");
    expect(html).not.toContain("0 quotes");
    expect(html).toContain('href="/theories/ground-blindness"');
    const back = await (await get("/theories/ground-blindness")).text();
    expect(back).toContain('href="/articles/seeing-what-you-rely-on"');
  });

  it("a DOI shows as a link to its resolver, and nothing shows without one", () => {
    expect(doiChip("10.5281/zenodo.123")).toContain('href="https://doi.org/10.5281/zenodo.123"');
    expect(doiChip(undefined)).toBe("");
  });

  it("the site calls itself a publication, not a notebook", async () => {
    const html = await (await get("/")).text();
    expect(html).toContain("An independent research publication by Chris Telford");
    expect(html).not.toContain("research and development notebook");
  });
});
