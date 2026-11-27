// Figures in essays, briefs and papers (2026-11-26): a bar chart drawn in
// HTML from front matter, and the theories' loop reused. Every chart value is
// in the piece's own text (the build fails otherwise).

import { describe, expect, it } from "vitest";
import app from "../src/index";
import { allArticles, allPapers } from "../src/site/content/store";
import { chartHtml, placeAfter } from "../src/site/pages/figure";

const env = { LOG_LEVEL: "error" };
const get = (path: string) => app.fetch(new Request(`http://test${path}`), env);

describe("figures", () => {
  it("draws a chart under the section it names, with its source", async () => {
    const html = await (await get("/articles/why-people-stop-taking-medicine-that-works")).text();
    const at = html.indexOf('<figure class="chart"');
    expect(at).toBeGreaterThan(html.indexOf("What is the most common reason people stop"));
    expect(html).toContain('<span class="ch-v">46.6%</span>');
    expect(html).toContain('class="ch-src">Source:');
  });

  it("draws the loop on an essay that has one", async () => {
    const html = await (await get("/articles/why-you-leave-it-for-the-morning")).text();
    expect(html).toContain('<figure class="cycle">');
    expect(html.indexOf('<figure class="cycle">')).toBeGreaterThan(
      html.indexOf("The plan that quiets the evening"),
    );
  });

  it("every chart value is written in its piece", () => {
    for (const p of [...allArticles(), ...allPapers()])
      for (const b of p.chart ?? []) {
        const v = b.split("|")[1]?.trim() ?? "";
        expect(p.body.replace(/,(?=\d{3})/g, ""), `${p.slug}: ${b}`).toContain(v);
      }
  });

  it("scales bars to the largest and places after the first paragraph", () => {
    const html = chartHtml({ chart: ["A|50", "B|25"], chart_title: "T", chart_unit: "%" });
    expect(html).toContain("width:100%");
    expect(html).toContain("width:50%");
    expect(placeAfter("<h2>One</h2><p>a</p><p>b</p>", "one", "<X/>")).toBe(
      "<h2>One</h2><p>a</p><X/><p>b</p>",
    );
  });
});
