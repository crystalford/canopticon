// Slugs are the part of this publication that other people copy.
//
// Every document published before migration 0052 had a Claude export filename
// with a UUID for a URL. Renaming them is only safe if the old URL survives,
// and only worth doing if the new one is actually better — so both halves are
// pinned here.

import { describe, expect, it } from "vitest";
import { EDITOR, resolveByline, showsUpdate } from "../src/lib/byline";
import { looksLikeMachineSlug, pieceSlug } from "../src/lib/slug";
import { displayTitle, looksLikeGenericTitle, looksLikeMachineFilename } from "../src/lib/title";

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

describe("titles that name a section instead of the work", () => {
  it("catches the generic headings the live corpus published under", () => {
    // Measured in the corpus: "Profile", "Title and Executive Summary".
    // The extractor takes the first heading, which is right most of the time
    // and wrong in exactly this way.
    for (const t of ["Profile", "Introduction", "Title and Executive Summary", "Overview"]) {
      expect(looksLikeGenericTitle(t)).toBe(true);
    }
  });

  it("does not fire on a real title", () => {
    for (const t of [
      "The Carney Performance",
      "Did Banning Airbnb Actually Fix Canadian Housing?",
      "Research Brief: Negative Partisanship",
    ]) {
      expect(looksLikeGenericTitle(t)).toBe(false);
    }
  });

  it("looks past a generic heading to the real one in the body", () => {
    expect(
      displayTitle("Profile", "## Profile\n\n## Mark Carney and the Bank of England\n\nText"),
    ).toBe("Mark Carney and the Bank of England");
  });

  it("keeps the subject when a generic word only prefixes it", () => {
    expect(displayTitle("Introduction: The Pattern in Brief", "")).toBe("The Pattern in Brief");
  });

  it("strips a stray markdown heading mark", () => {
    expect(displayTitle("# A Comprehensive Map of McLuhan's Thought", "")).toBe(
      "A Comprehensive Map of McLuhan's Thought",
    );
  });

  it("catches a filename whose download suffix added whitespace", () => {
    // The live corpus has `..._text_markdown (1).md`. The " (1)" is whitespace,
    // and the "anything with a space was written by a person" rule let it
    // publish as a page title.
    expect(
      looksLikeMachineFilename(
        "compass_artifact_wf-5af5d7fc-a6be-44e5-a7bb-c4b8b2100877_text_markdown (1).md",
      ),
    ).toBe(true);
  });

  it("still refuses to rename a short filename-ish title", () => {
    // The length floor outranks the extension check; over-correcting a real
    // title is worse than letting one odd one through.
    expect(looksLikeMachineFilename("notes.md")).toBe(false);
  });
});

describe("authorship and freshness", () => {
  it("resolves placeholder bylines to the named editor", () => {
    // The stored rows predate there being a name. Hiding them removed the
    // citation signal; rewriting the database would be a migration to fix a
    // display problem.
    for (const p of ["the operator", "Canopticon", "canopticon research agent", "", null]) {
      expect(resolveByline(p)).toBe(EDITOR);
    }
  });

  it("leaves a real byline alone", () => {
    expect(resolveByline("Jane Smith")).toBe("Jane Smith");
  });

  it("only calls something updated when it is a day or more later", () => {
    // A page that says "Updated" on its publication day is noise, and a record
    // that cries update over a whitespace change is worse than a quiet one.
    const pub = "2026-09-01T00:00:00.000Z";
    expect(showsUpdate(pub, "2026-09-01T06:00:00.000Z")).toBe(false);
    expect(showsUpdate(pub, "2026-09-03T00:00:00.000Z")).toBe(true);
    expect(showsUpdate(pub, null)).toBe(false);
    expect(showsUpdate(null, pub)).toBe(false);
  });
});
