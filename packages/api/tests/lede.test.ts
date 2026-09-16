// The lead passage is SELECTED from the document, never composed.
//
// That distinction is the whole design, and it is the thing that would decay
// silently: a composed summary looks identical on the page to a selected one,
// right up until someone follows the citation and the words are not there.

import { describe, expect, it } from "vitest";
import { locateVerbatim } from "../src/graph/lib/digestion-typed";

const DOC = `# The Canadian Economic Dossier

Federal health transfers to the provinces reached $52.1 billion in 2025-26, according to the Department of Finance. Provincial health spending grew 4.8 percent over the same period, outpacing the transfer escalator of 3.0 percent set in 2023.

The Parliamentary Budget Officer noted in March 2026 that the gap would compound to roughly $9 billion annually by 2030.`;

describe("the lede firewall", () => {
  it("accepts a passage the document actually contains", () => {
    const passage =
      "Federal health transfers to the provinces reached $52.1 billion in 2025-26, according to the Department of Finance.";
    const hit = locateVerbatim(DOC, passage);
    expect(hit).not.toBeNull();
    expect(DOC).toContain(hit?.text ?? "no-such-text");
  });

  it("rejects a passage the model composed rather than copied", () => {
    // The failure this exists to prevent: a fluent, plausible summary that
    // appears nowhere in the source. It reads perfectly and is unsourced.
    const composed =
      "This dossier establishes that federal health transfers are failing to keep pace with provincial spending growth.";
    expect(locateVerbatim(DOC, composed)).toBeNull();
  });

  it("rejects a passage stitched from two separate places", () => {
    const stitched =
      "Federal health transfers to the provinces reached $52.1 billion in 2025-26. The Parliamentary Budget Officer noted in March 2026 that the gap would compound.";
    expect(locateVerbatim(DOC, stitched)).toBeNull();
  });

  it("stores the DOCUMENT's bytes when the model reflows whitespace", () => {
    const reflowed =
      "Provincial health spending grew 4.8 percent over the same\nperiod, outpacing the transfer escalator of 3.0 percent set in 2023.";
    const hit = locateVerbatim(DOC, reflowed);
    expect(hit).not.toBeNull();
    expect(DOC).toContain(hit?.text ?? "no-such-text");
    // What is stored is never the model's version of the text.
    expect(hit?.text).not.toBe(reflowed);
  });
});
