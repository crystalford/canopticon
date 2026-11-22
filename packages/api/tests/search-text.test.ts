// What a search result can show whole: titles near 60 characters, descriptions
// under 160. The page itself keeps everything (layout.ts).

import { describe, expect, it } from "vitest";
import { searchDescription, searchTitle } from "../src/site/layout";

describe("search titles and descriptions", () => {
  it("keeps a short title as it is", () => {
    expect(searchTitle("Krasis")).toBe("Krasis");
  });

  it("keeps the part before the colon when it stands alone", () => {
    expect(
      searchTitle(
        "Portraiture as a research method: Sara Lawrence-Lightfoot's painting with words and what it asks of a researcher",
      ),
    ).toBe("Portraiture as a research method");
  });

  it("cuts a long title with no usable colon at a word", () => {
    const t = searchTitle("a ".repeat(50).trim());
    expect(t.length).toBeLessThanOrEqual(60);
    expect(t.endsWith("…")).toBe(true);
  });

  it("cuts a long description at a sentence, else at a word", () => {
    const long = `${"Every quote links back to its source. ".repeat(6)}`;
    const d = searchDescription(long);
    expect(d.length).toBeLessThanOrEqual(160);
    expect(d.endsWith(".")).toBe(true);
    expect(searchDescription("short")).toBe("short");
  });
});
