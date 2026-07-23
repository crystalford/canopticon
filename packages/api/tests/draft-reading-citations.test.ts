import { describe, expect, it } from "vitest";
import { applyCitationMarkers } from "../src/graph/lib/draft-reading.ts";

// Regression test for a real bug found live: the writer's raw [qN] markers
// (e.g. "the claim text [q3]") were stored and rendered verbatim — readers
// saw the literal bracket text on published pages (confirmed at
// canopticon.com/p/larry-fink?mode=signed). applyCitationMarkers is the
// fix: it must turn every marker whose claim survived verification into a
// real numbered link, and silently drop any marker that didn't survive —
// never leave bracket text in the output either way.

describe("applyCitationMarkers", () => {
  const shortToReal = new Map([
    ["q1", "real-quote-1"],
    ["q2", "real-quote-2"],
    ["q3", "real-quote-3"],
  ]);

  it("replaces a passed marker with a real numbered link, never bracket text", () => {
    const out = applyCitationMarkers("Carney chaired the bank [q1].", shortToReal, new Set(["q1"]));
    expect(out).not.toContain("[q1]");
    expect(out).toContain('<a class="cite-n" href="/q/real-quote-1">1</a>');
  });

  it("strips a marker whose claim did NOT survive judging — no naked bracket left behind", () => {
    const out = applyCitationMarkers("A disputed claim [q2].", shortToReal, new Set());
    expect(out).not.toContain("[q2]");
    expect(out).not.toContain("cite-n");
    expect(out).toBe("A disputed claim .");
  });

  it("handles combined markers [q2, q8] — keeps only the ids that passed", () => {
    const out = applyCitationMarkers(
      "Two facts together [q1, q2].",
      shortToReal,
      new Set(["q1"]), // q2 did not pass
    );
    expect(out).not.toContain("[q1, q2]");
    expect(out).toContain('href="/q/real-quote-1"');
    expect(out).not.toContain("real-quote-2");
  });

  it("numbers markers in first-appearance order, reusing the same number on repeat citation", () => {
    const out = applyCitationMarkers(
      "First [q2]. Later the same fact again [q2]. Then a new one [q1].",
      shortToReal,
      new Set(["q1", "q2"]),
    );
    expect(out).toContain('href="/q/real-quote-2">1</a>');
    expect(out).toContain('href="/q/real-quote-1">2</a>');
    // The second [q2] reference reuses citation number 1, not a new number.
    const secondOccurrence = out.split('href="/q/real-quote-2"').length - 1;
    expect(secondOccurrence).toBe(2);
  });

  it("drops a marker whose short id was never in the grounding menu at all", () => {
    const out = applyCitationMarkers(
      "A fabricated citation [q99].",
      shortToReal,
      new Set(["q99"]), // even if somehow marked passed, there's no real quote behind it
    );
    expect(out).not.toContain("[q99]");
    expect(out).not.toContain("cite-n");
  });

  it("leaves prose with no markers untouched", () => {
    const out = applyCitationMarkers("Plain prose, no citations here.", shortToReal, new Set());
    expect(out).toBe("Plain prose, no citations here.");
  });

  // Confirmed live on a real reading (marshall-mcluhan) after the
  // exact-[qN]-only regex shipped: the model drifts under real load.

  it("expands a dash range [q1-2] into both real quote ids", () => {
    const out = applyCitationMarkers("Two facts [q1-2].", shortToReal, new Set(["q1", "q2"]));
    expect(out).not.toContain("[q1-2]");
    expect(out).toContain('href="/q/real-quote-1"');
    expect(out).toContain('href="/q/real-quote-2"');
  });

  it("strips a stray non-q prefix marker like [p26] — never left as bracket text", () => {
    const out = applyCitationMarkers("Some claim [p26].", shortToReal, new Set());
    expect(out).not.toContain("[p26]");
    expect(out).not.toContain("cite-n");
    expect(out).toBe("Some claim .");
  });

  it("accepts semicolon-separated markers", () => {
    const out = applyCitationMarkers("Two facts [q1; q2].", shortToReal, new Set(["q1", "q2"]));
    expect(out).not.toContain("[q1; q2]");
    expect(out).toContain('href="/q/real-quote-1"');
    expect(out).toContain('href="/q/real-quote-2"');
  });

  it("does NOT touch a bare bracketed year or number — no letter prefix means it isn't a citation", () => {
    const out = applyCitationMarkers(
      "Published in [1968] under contract [42].",
      shortToReal,
      new Set(["q1", "q2"]),
    );
    expect(out).toBe("Published in [1968] under contract [42].");
  });
});
