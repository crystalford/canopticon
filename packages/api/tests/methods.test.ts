// Methods (2026-11-28): a theory's protocol made into something to run. Each
// has steps for a person, the exact instruction for a model, a worked example
// and where it fails; a Markdown twin; and a SKILL.md that installs in Claude.

import { describe, expect, it } from "vitest";
import app from "../src/index";
import { allMethods, theory } from "../src/site/content/store";

const env = { LOG_LEVEL: "error" };
const get = (path: string) => app.fetch(new Request(`http://test${path}`), env);

describe("methods", () => {
  it("each method names a real theory and carries its instruction and steps", () => {
    expect(allMethods().length).toBeGreaterThan(0);
    for (const m of allMethods()) {
      expect(theory(m.theory), m.slug).not.toBeNull();
      expect(m.instruction.length, m.slug).toBeGreaterThan(200);
      expect(m.steps.length, m.slug).toBeGreaterThanOrEqual(3);
    }
  });

  it("lists every method on /methods, under its section label", async () => {
    const html = await (await get("/methods")).text();
    expect(html).toContain("The tools");
    for (const m of allMethods()) expect(html).toContain(`href="/methods/${m.slug}"`);
  });

  it("shows the instruction once, before the worked example, with copy and the skill", async () => {
    for (const m of allMethods()) {
      const html = await (await get(`/methods/${m.slug}`)).text();
      expect(html, m.slug).toContain('id="mth-inst-t"');
      expect(html.indexOf('id="the-instruction"'), m.slug).toBeLessThan(
        html.indexOf("Worked example</h2>"),
      );
      const first = (m.instruction.split("\n")[0] ?? "").replace(/'/g, "&#39;").slice(0, 40);
      expect(html.split(first).length - 1, m.slug).toBe(1);
      expect(html).toContain(`href="/methods/${m.slug}/SKILL.md"`);
      expect(html).toContain('"@type":"HowTo"');
    }
  });

  it("downloads as a skill Claude can load", async () => {
    const m = allMethods()[0];
    const res = await get(`/methods/${m?.slug}/SKILL.md`);
    expect(res.headers.get("content-disposition")).toContain("SKILL.md");
    const text = await res.text();
    expect(text).toMatch(/^---\nname: [a-z0-9-]+\ndescription: ".+"\n---\n/);
    expect(text).toContain(m?.instruction.split("\n")[0] ?? "x");
    expect(text).toContain("## Where it fails");
  });

  it("has a Markdown twin, and its theory points to it", async () => {
    const m = allMethods()[0];
    const md = await (await get(`/methods/${m?.slug}.md`)).text();
    expect(md).toContain(`# ${m?.title}`);
    const t = await (await get(`/theories/${m?.theory}`)).text();
    expect(t).toContain(`href="/methods/${m?.slug}"`);
  });

  it("is in the sitemap and llms.txt", async () => {
    const sitemap = await (await get("/sitemap.xml")).text();
    for (const m of allMethods()) expect(sitemap).toContain(`/methods/${m.slug}`);
    expect(await (await get("/llms.txt")).text()).toContain("/methods");
  });
});
