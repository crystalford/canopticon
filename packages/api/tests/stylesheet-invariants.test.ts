// The stylesheet's structural rules, as tests.
//
// This file exists because the site drifted into what the operator called "a
// frankenstein patchwork of bubble gum and duct tape", and the drift was not
// in any one page — it was in the stylesheet growing a new generation every
// time a feature landed. Six naming eras, five page widths, six panel
// treatments, 276 dead class selectors. Each one arrived as a reasonable
// local decision.
//
// A screenshot catches a bad page. Only a test catches the SECOND page width.

import { describe, expect, it } from "vitest";
import { STYLES_CSS } from "../src/public/styles";

/** The stylesheet with comments stripped — prose must not be mistaken for CSS. */
const CSS = STYLES_CSS.replace(/\/\*[\s\S]*?\*\//g, "");

describe("the template literal itself", () => {
  it("contains no backtick", () => {
    // Four separate incidents. STYLES_CSS is one giant template literal, so a
    // backtick anywhere inside it — including inside a CSS comment, which is
    // where it happened every time, usually quoting a class or a keyword —
    // terminates the string early. The build then fails somewhere unrelated
    // and the cause is invisible. Write the word plainly instead.
    expect(STYLES_CSS).not.toContain("`");
  });

  it("has balanced braces", () => {
    // `biome check --write` has silently eaten braces out of this file before,
    // taking a media query's contents with them. A count is a crude check and
    // still the one that would have caught it.
    const open = (CSS.match(/{/g) ?? []).length;
    const close = (CSS.match(/}/g) ?? []).length;
    expect(open).toBe(close);
  });
});

describe("one shell width", () => {
  // The nav, the trust strip and the footer centred on 1060px; the content
  // container on 1100px; document pages on 1260px; reading pages on 920px;
  // answer pages on 820px. So the wordmark and the H1 directly beneath it
  // never shared a left edge — on any page. That is most of what "nothing
  // lines up" was.
  const SPANNING = [".nav-inner", ".op-topbar-inner", ".trust-inner", ".foot-inner", ".container"];

  it.each(SPANNING)("%s resolves its width from --shell", (sel) => {
    const rule = ruleFor(sel);
    expect(rule, `no rule found for ${sel}`).toBeTruthy();
    expect(rule).toMatch(/max-width:\s*var\(--shell\)/);
  });

  it("defines --shell and --gutter exactly once each at the root", () => {
    expect(CSS.match(/--shell:\s*\d/g) ?? []).toHaveLength(1);
    // --gutter is declared at :root and narrowed once for phones.
    expect((CSS.match(/--gutter:\s*\d/g) ?? []).length).toBeLessThanOrEqual(2);
  });

  it("no page-spanning element carries a hardcoded pixel width", () => {
    // The specific values that were competing. Any of them reappearing means
    // a component has opted out of the shell again.
    for (const px of ["1060px", "1100px", "1260px"]) {
      expect(CSS, `${px} is back in the stylesheet`).not.toContain(`max-width: ${px}`);
    }
  });

  it("main contributes no gutter of its own", () => {
    // It used to add 20px of side padding on top of the .container inside it,
    // so content sat at the nav's left edge plus 20 — and the gap widened as
    // the viewport narrowed. The container owns horizontal position.
    const main = CSS.match(/(^|\n)main\s*{([^}]*)}/);
    expect(main).toBeTruthy();
    expect(main?.[2]).not.toMatch(/padding:[^;]*\b(?!0)\d+px\s+\d*[1-9]\d*px/);
  });
});

describe("one panel treatment", () => {
  // Furniture used to wear four different borders: solid rule, solid nested
  // inside another solid, dashed rule-bright, dashed ink-faint. A border
  // cannot mean anything to a reader when it means four things.
  const PANELS = [".toc", ".citebox", ".doc-gaps", ".piece-note", ".thin-note"];

  it.each(PANELS)("%s uses the one solid-rule panel", (sel) => {
    const rule = ruleFor(sel);
    expect(rule, `no rule found for ${sel}`).toBeTruthy();
    expect(rule).toMatch(/border:\s*1px solid var\(--rule\)/);
    expect(rule).toMatch(/background:\s*var\(--paper-2\)/);
  });

  it("spends a dashed border only on provisional or voided things", () => {
    // A dashed edge does convey one thing well — "this is not settled" — so
    // it stays where it carries that meaning: .chip.draft (provisional) and
    // .killed (a claim that failed verification). It is not a second panel
    // style, and every furniture block that had borrowed it now wears the
    // panel above. Adding a dashed border to anything else means picking a
    // decoration over a signal.
    const ALLOWED = [".chip.draft", ".killed"];
    const dashed = [...CSS.matchAll(/([^{}]+){[^}]*border[^;}]*dashed[^;}]*;/g)]
      .map((m) => (m[1] ?? "").trim().split("\n").pop()?.trim() ?? "")
      .filter((sel) => !ALLOWED.some((a) => sel.includes(a)));
    expect(dashed).toEqual([]);
  });
});

describe("the card grid cannot stretch a lone card", () => {
  it("uses auto-fill, never auto-fit", () => {
    // auto-fit COLLAPSES empty tracks and stretches the survivors, so a topic
    // holding one document rendered it as a single card 1,116px wide.
    const rgrid = ruleFor(".rgrid");
    expect(rgrid).toMatch(/auto-fill/);
    expect(rgrid).not.toMatch(/auto-fit/);
  });
});

/** The declaration block of the first rule whose selector list contains `sel`. */
function ruleFor(sel: string): string | undefined {
  const escaped = sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?:^|[\\n,])\\s*${escaped}\\s*(?:,[^{]*)?{([^}]*)}`, "m");
  return CSS.match(re)?.[1];
}

describe("a flex class never lands on a table cell", () => {
  it(".coord is not applied to a td anywhere in the renderers", async () => {
    // .coord is display:flex. On a <td> that destroys the element's
    // table-cell behaviour: the browser wraps it in an anonymous cell, so it
    // stops sharing the row box, and /library drew four disjoint row-rule
    // segments at different heights because two of its four cells were no
    // longer in the row. The class belongs on a span INSIDE the cell.
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const files: string[] = [];
    (function walk(d: string) {
      for (const e of readdirSync(d)) {
        const f = join(d, e);
        if (statSync(f).isDirectory()) walk(f);
        else if (f.endsWith(".ts")) files.push(f);
      }
    })("src");
    const offenders = files.filter((f) =>
      /<td[^>]*class="[^"]*\bcoord\b/.test(readFileSync(f, "utf8")),
    );
    expect(offenders).toEqual([]);
  });

  it("declares .coord exactly once", () => {
    // It was declared twice with the same selector and different values, so
    // the first block was unreachable — a reader editing it changed nothing.
    expect(CSS.match(/(^|\n)\.coord\s*{/g) ?? []).toHaveLength(1);
  });
});
