// Admin's composer guesses what a message is asking for with plain rules
// (write/kind.ts), shown before anything starts; and a "read …" message
// finds its document by title only when it is clear which.

import { describe, expect, it } from "vitest";
import { guessKind, kindRulesJson, matchTitle } from "../src/write/kind";
import type { Source } from "../src/write/sources";

describe("guessing the kind", () => {
  it.each([
    ["Did short-term rental bans lower rents in Canadian cities?", "research"],
    ["Write about why whey curdles in hot coffee", "article"],
    ["Draft a piece on the rent bans", "article"],
    ["Turn the rent report into an article", "article"],
    ["Make an essay out of the McLuhan notes", "article"],
    ["Read the Beyond RSS report", "read"],
    ["Lay out what the whey dossier says", "read"],
    ["Go through budget-2026.pdf", "read"],
    ["“Instant-Dissolving Whey for Hot Coffee”", "read"],
    ["Test whether minimum wages cut youth jobs", "thesis"],
    ["Is it true that bans lower rents?", "thesis"],
    ["Claim: rent caps reduce supply", "thesis"],
    ["Reading lists for media theory", "research"],
    ["Writers who covered the bans", "research"],
  ])("%s → %s", (text, kind) => {
    expect(guessKind(text)).toBe(kind);
  });

  it("reads files added with nothing said", () => {
    expect(guessKind("", ["report.md"])).toBe("read");
    expect(guessKind("What do these say about rents?", ["report.md"])).toBe("research");
  });

  it("hands the page the same rules", () => {
    const rules = JSON.parse(kindRulesJson()) as Array<[string, string, string]>;
    for (const [kind, src, flags] of rules) {
      const re = new RegExp(src, flags);
      expect(typeof kind).toBe("string");
      expect(re).toBeInstanceOf(RegExp);
    }
    expect(rules[0]?.[0]).toBe("thesis");
  });
});

describe("finding a document by title", () => {
  const src = (id: string, title: string): Source => ({
    id,
    title,
    topic: "",
    kind: "research",
    date: "",
    chars: 1,
    status: "record",
  });
  const all = [
    src(
      "whey",
      "Instant-Dissolving Whey for Hot Coffee: Where the Science and Manufacturing Stand",
    ),
    src("rss", "Beyond RSS: The Episode Graph"),
    src("rss2", "Beyond RSS: Podcast Discovery"),
    src("rent", "Rents After the Ban: Toronto, Vancouver and Montreal, 2023–2026"),
  ];

  it("takes an exact title", () => {
    expect(matchTitle("Read “Beyond RSS: The Episode Graph”", all)?.id).toBe("rss");
  });

  it("takes the one title holding most of the words", () => {
    expect(matchTitle("read the instant dissolving whey coffee report in full", all)?.id).toBe(
      "whey",
    );
    expect(matchTitle("read the coffee report", all)).toBeNull();
    expect(matchTitle("read instant dissolving whey hot coffee", all)?.id).toBe("whey");
    expect(matchTitle("Lay out rents after the ban", all)?.id).toBe("rent");
  });

  it("does not guess between two", () => {
    expect(matchTitle("Read Beyond RSS", all)).toBeNull();
  });
});
