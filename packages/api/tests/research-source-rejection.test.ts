// A fetched page is refused BEFORE any write when it is not a page at all.
//
// Observed in the library: "Just a moment..." — Cloudflare's bot challenge,
// banked as a research report — and a brainly.com answer stub. Both were
// third-party junk with a `pieces` row and a /library entry. rejectFetchedPage
// is the pure gate over what a fetch returned; these pin the exact rules so
// they cannot loosen without a test noticing.

import { describe, expect, it } from "vitest";
import { MIN_TEXT_CHARS, rejectFetchedPage } from "../src/graph/lib/record-builder";

const ARTICLE = "A real paragraph of article text with some substance to it. ".repeat(12);

describe("rejectFetchedPage — bot-challenge and blocked pages", () => {
  it.each([
    "Just a moment...",
    "Attention Required! | Cloudflare",
    "Access Denied",
    "Verifying you are human",
    "Checking your browser before accessing example.com",
    "  just a moment  ",
  ])("rejects by title: %s", (title) => {
    // The body is long and ordinary on purpose: the title alone decides.
    expect(rejectFetchedPage(title, ARTICLE)).toBe("bot challenge");
  });

  it.each(["challenge-platform", "cf_chl", "Enable JavaScript and cookies to continue"])(
    "rejects by body marker: %s",
    (marker) => {
      expect(rejectFetchedPage("An ordinary title", `${ARTICLE} ${marker} ${ARTICLE}`)).toBe(
        "bot challenge",
      );
    },
  );

  it("names a reader-proxied 403 as blocked, not as a bot challenge", () => {
    // Jina reports a blocked origin inline as text, with a 200 of its own.
    const body = `Warning: Target URL returned error 403: Forbidden\n\n${ARTICLE}`;
    expect(rejectFetchedPage("Some title", body)).toBe("blocked (403 via reader)");
  });

  it("does not match a title that merely contains a marker phrase", () => {
    // The title rule is anchored at the start; an article ABOUT bot
    // challenges is still an article.
    expect(rejectFetchedPage("Why 'Just a moment' pages exist", ARTICLE)).toBeNull();
  });
});

describe("rejectFetchedPage — thin pages", () => {
  it("rejects a body under MIN_TEXT_CHARS with the count in the reason", () => {
    const short = "x".repeat(MIN_TEXT_CHARS - 1);
    expect(rejectFetchedPage("Fine title", short)).toBe(`too short (${MIN_TEXT_CHARS - 1} chars)`);
  });

  it("accepts a body exactly at the floor", () => {
    expect(rejectFetchedPage("Fine title", "x".repeat(MIN_TEXT_CHARS))).toBeNull();
  });

  it("reports a challenge page as a bot challenge even when it is also short", () => {
    // The more useful reason wins; "too short" would send the operator
    // looking at the wrong thing.
    expect(rejectFetchedPage("Just a moment...", "Enable JavaScript and cookies to continue")).toBe(
      "bot challenge",
    );
  });

  it("accepts an ordinary article", () => {
    expect(rejectFetchedPage("Housing starts fell in Q2", ARTICLE)).toBeNull();
  });
});
