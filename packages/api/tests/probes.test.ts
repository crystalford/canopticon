// Probes (2026-11-28): the author's ideas in progress — story ideas, scenes,
// characters, short probes, poems, lyrics and build notes — each with a form,
// a stage and a date, a Markdown twin, and scenes set as a script page.

import { describe, expect, it } from "vitest";
import app from "../src/index";
import { allProbes } from "../src/site/content/store";
import { PROBE_FORMS, screenplayHtml } from "../src/site/pages/probes";

const env = { LOG_LEVEL: "error" };
const get = (path: string) => app.fetch(new Request(`http://test${path}`), env);

describe("probes", () => {
  it("each has a known form and stage, and answers with its twin", async () => {
    expect(allProbes().length).toBeGreaterThan(0);
    for (const p of allProbes()) {
      expect(PROBE_FORMS as readonly string[]).toContain(p.form);
      expect(["Seed", "Draft", "Finished"]).toContain(p.stage);
      expect((await get(`/probes/${p.slug}`)).status, p.slug).toBe(200);
      const md = await (await get(`/probes/${p.slug}.md`)).text();
      expect(md).toContain(`# ${p.title}`);
    }
  });

  it("lists them on /probes, filtered by form, and in the sitemap", async () => {
    const p = allProbes()[0];
    const html = await (await get("/probes")).text();
    expect(html).toContain(`href="/probes/${p?.slug}"`);
    const one = await (await get(`/probes?form=${encodeURIComponent(p?.form ?? "")}`)).text();
    expect(one).toContain(`href="/probes/${p?.slug}"`);
    const map = await (await get("/sitemap.xml")).text();
    expect(map).toContain(`/probes/${p?.slug}`);
  });

  it("sets a screenplay the way a script page is set", () => {
    const html = screenplayHtml(
      "INT. CABIN - NIGHT\n\nA fire burns low. MARA feeds it a branch.\n\nMARA\n(quietly)\nIt answers back.\n\nCUT TO:",
    );
    expect(html).toContain('<p class="sp-h">INT. CABIN - NIGHT</p>');
    expect(html).toContain('<p class="sp-a">A fire burns low. MARA feeds it a branch.</p>');
    expect(html).toContain(
      '<p class="sp-c">MARA</p><p class="sp-p">(quietly)</p><p class="sp-d">It answers back.</p>',
    );
    expect(html).toContain('<p class="sp-t">CUT TO:</p>');
  });
});
