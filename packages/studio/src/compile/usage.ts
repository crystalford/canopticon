// Which primitives are actually load-bearing.
//
// The palette has 47 sources — primitives that generate from nothing. Some
// are substrate: `noise_field` and `flow_field` exist to FEED the particle
// system, and a film would be poorer without them. Others are terminal
// decoration: they only ever appear as a final frame, chosen because a word
// in the script sounded like them.
//
// The difference is not abstract-vs-concrete and it cannot be judged by
// looking at a primitive. It is whether anything downstream consumes it.
// This measures that from real compiles, so the palette can be pruned on
// evidence rather than on instinct — and so a source that turns out to be
// substrate is never cut for looking decorative.

import { PRIMITIVES } from "../primitives/registry.ts";
import type { ComposedScene } from "./compose.ts";

export interface PrimitiveUsage {
  primitiveId: string;
  family: string;
  /** A source generates from nothing; a transformer acts on upstream. */
  role: "source" | "transformer";
  /** Times it appeared in any composed chain. */
  uses: number;
  /** Times a source's output was consumed by a later node in its chain.
   *  Zero across a whole film means it only ever produced final frames. */
  consumed: number;
}

export interface UsageReport {
  primitives: PrimitiveUsage[];
  /** Sources that appeared but were never consumed by anything — the
   *  candidates for removal, named rather than guessed at. */
  terminalSources: string[];
  /** Sources whose output fed something else. Substrate; keep. */
  loadBearingSources: string[];
  unusedInPalette: number;
  /** Links this film relies on where the CONSUMER declares an input type and
   *  never reads it — a seam the type system approved that does nothing at
   *  runtime. Named with counts so the debt is a list of specific
   *  primitives to fix rather than a feeling that the palette is thin.
   *
   *  Across the whole palette: 74 primitives declare an input and 16 read
   *  it. That is the real state of the thing, and it is why a chain of five
   *  can render as its last element. */
  decorativeLinks: { link: string; uses: number }[];
  /** How much of this film's chaining is real, 0..1. */
  linkHonesty: number;
}

export function analyseUsage(scenes: ComposedScene[]): UsageReport {
  const uses = new Map<string, number>();
  const consumed = new Map<string, number>();
  const decorative = new Map<string, number>();

  for (const scene of scenes) {
    const ids = scene.nodes.map((n) => n.primitiveId);
    ids.forEach((id, i) => {
      uses.set(id, (uses.get(id) ?? 0) + 1);
      // Consumed if any LATER node in this chain declares an input. The
      // chain is linear, so a downstream consumer is a real consumer.
      const downstream = ids.slice(i + 1);
      // Consumed by something that ACTUALLY READS ITS INPUT. Declaring one
      // is not the same as reading it, and this check used to accept the
      // declaration — the same mistake the type system made, so the measure
      // built to prune the palette on evidence was itself reporting a
      // hopeful number.
      const isConsumed = downstream.some(
        (next) => (PRIMITIVES[next]?.inputs ?? []).length > 0 && PRIMITIVES[next]?.consumesUpstream,
      );
      if (isConsumed) consumed.set(id, (consumed.get(id) ?? 0) + 1);
      // A link where the consumer declares an input and ignores it. The
      // chain typechecks, runs, and the later primitive draws over the
      // earlier one having read nothing from it.
      const next = ids[i + 1];
      if (
        next &&
        (PRIMITIVES[next]?.inputs ?? []).length > 0 &&
        !PRIMITIVES[next]?.consumesUpstream
      ) {
        decorative.set(`${id} → ${next}`, (decorative.get(`${id} → ${next}`) ?? 0) + 1);
      }
    });
  }

  const primitives: PrimitiveUsage[] = [...uses.keys()]
    .map((id) => {
      const spec = PRIMITIVES[id];
      return {
        primitiveId: id,
        family: spec?.family ?? "unknown",
        role: (spec?.inputs.length ?? 0) === 0 ? ("source" as const) : ("transformer" as const),
        uses: uses.get(id) ?? 0,
        consumed: consumed.get(id) ?? 0,
      };
    })
    .sort((a, b) => b.uses - a.uses);

  const sources = primitives.filter((p) => p.role === "source");
  return {
    primitives,
    terminalSources: sources
      .filter((p) => p.consumed === 0)
      .map((p) => p.primitiveId)
      .sort(),
    loadBearingSources: sources
      .filter((p) => p.consumed > 0)
      .map((p) => p.primitiveId)
      .sort(),
    unusedInPalette: Object.keys(PRIMITIVES).length - uses.size,
    decorativeLinks: [...decorative.entries()]
      .map(([link, n]) => ({ link, uses: n }))
      .sort((a, b) => b.uses - a.uses),
    linkHonesty: honesty(scenes),
  };
}

/** The proportion of this film's chain LINKS that actually carry something.
 *  A film of five-primitive chains where only the last one reads anything is
 *  not five times richer than a film of one — and until this was measured
 *  there was no way to tell those two films apart from the outside. */
function honesty(scenes: ComposedScene[]): number {
  let total = 0;
  let real = 0;
  for (const scene of scenes) {
    const ids = scene.nodes.map((n) => n.primitiveId);
    for (let i = 1; i < ids.length; i++) {
      total++;
      if (PRIMITIVES[ids[i] as string]?.consumesUpstream) real++;
    }
  }
  return total === 0 ? 1 : Math.round((real / total) * 1000) / 1000;
}
