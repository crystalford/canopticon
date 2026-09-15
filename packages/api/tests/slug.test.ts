// Slugs are the part of this publication that other people copy.
//
// Every document published before migration 0052 had a Claude export filename
// with a UUID for a URL. Renaming them is only safe if the old URL survives,
// and only worth doing if the new one is actually better — so both halves are
// pinned here.

import { describe, expect, it } from "vitest";
import { looksLikeMachineSlug, pieceSlug } from "../src/lib/slug";

describe("recognising a filename pretending to be a URL", () => {
  it("catches the shape the whole corpus shipped with", () => {
    expect(
      looksLikeMachineSlug(
        "compass-artifact-wf-facec16e-8872-4a9f-a905-feabce4b8aa9-text-markdown",
      ),
    ).toBe(true);
  });

  it("leaves a real slug alone", () => {
    // A false positive here renames a good URL for no reason and retires a
    // citation that was working.
    expect(looksLikeMachineSlug("the-logic-costume")).toBe(false);
    expect(looksLikeMachineSlug("did-banning-airbnb-actually-fix-canadian-housing")).toBe(false);
    expect(looksLikeMachineSlug("canadian-economic-dossier-1994-may-2026")).toBe(false);
  });
});

describe("building a slug a person would recognise", () => {
  it("keeps numbers and years, which are the specific part", () => {
    expect(pieceSlug("The Canadian Economic Dossier (1994–May 2026)")).toBe(
      "the-canadian-economic-dossier-1994-may-2026",
    );
    expect(pieceSlug("CANOPTICON DOSSIER — BILL C-22 (LAWFUL ACCESS ACT, 2026)")).toContain(
      "bill-c-22",
    );
  });

  it("deletes apostrophes rather than splitting on them", () => {
    // "canada-s-64m" reads as a typo; the separator is the bug, not the
    // apostrophe.
    expect(pieceSlug("Canada's €64M Investment in Latvia")).toBe(
      "canadas-64m-investment-in-latvia",
    );
  });

  it("never cuts mid-word when trimming a long title", () => {
    const long = pieceSlug(
      "Canadian Media Panel Coverage: A Documented Archive of Reframing Patterns When the Liberals Were Under Pressure",
    );
    expect(long.length).toBeLessThanOrEqual(72);
    expect(long.endsWith("-")).toBe(false);
    // Every segment is a whole word from the title, not a truncated stem.
    const words = new Set(
      "canadian media panel coverage a documented archive of reframing patterns when the liberals were under pressure".split(
        " ",
      ),
    );
    for (const seg of long.split("-")) expect(words.has(seg)).toBe(true);
  });

  it("produces nothing rather than junk when there is no title", () => {
    expect(pieceSlug("")).toBe("");
    expect(pieceSlug("—")).toBe("");
  });
});
