// Independence: cited sources that are really one — copies across sites, or
// several pages from one publisher.
import { describe, expect, it } from "vitest";
import { describeEchoes, echoGroups, independentCount } from "../src/write/independence";

const wire =
  "The federal government announced on Tuesday that it had signed a new agreement with the province to expand coverage of prescription drugs for residents, officials said in a statement released to reporters. ";
const filler = (seed: string, n: number) =>
  Array.from(
    { length: n },
    (_, i) => `${seed} sentence number ${i} talks about something else entirely here.`,
  ).join(" ");

const pages = [
  {
    url: "https://news-a.example/story",
    title: "A",
    text: filler("alpha", 30) + wire.repeat(3) + filler("beta", 20),
  },
  { url: "https://news-b.example/item", title: "B", text: filler("gamma", 25) + wire.repeat(3) },
  { url: "https://gov.example/release", title: "C", text: filler("delta", 40) },
  { url: "https://gov.example/backgrounder", title: "D", text: filler("epsilon", 40) },
  { url: "https://journal.example/study", title: "E", text: filler("zeta", 40) },
];
const numbers = new Map(pages.map((p, i) => [p.url, i + 1]));

describe("the independence check", () => {
  it("groups copies across sites and pages from one publisher, and nothing else", () => {
    const g = echoGroups(pages as never, numbers);
    expect(g.map((x) => [x.why, x.sources])).toEqual([
      ["wording", [1, 2]],
      ["publisher", [3, 4]],
    ]);
    expect(g[0]?.runs).toBeGreaterThanOrEqual(6);
    expect(g[0]?.sample).toContain("federal government announced");
    expect(independentCount(g, 5)).toBe(3);
  });

  it("tells the writer which to count once, and says nothing when all stand alone", () => {
    const g = echoGroups(pages as never, numbers);
    const said = describeEchoes(g, 5);
    expect(said).toContain("of 5 cited sources, about 3 are independent");
    expect(said).toContain("[3] [4]: all from gov.example");
    expect(describeEchoes([], 5)).toBe("");
  });
});
