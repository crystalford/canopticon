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
}

export function analyseUsage(scenes: ComposedScene[]): UsageReport {
  const uses = new Map<string, number>();
  const consumed = new Map<string, number>();

  for (const scene of scenes) {
    const ids = scene.nodes.map((n) => n.primitiveId);
    ids.forEach((id, i) => {
      uses.set(id, (uses.get(id) ?? 0) + 1);
      // Consumed if any LATER node in this chain declares an input. The
      // chain is linear, so a downstream consumer is a real consumer.
      const downstream = ids.slice(i + 1);
      const isConsumed = downstream.some((next) => (PRIMITIVES[next]?.inputs ?? []).length > 0);
      if (isConsumed) consumed.set(id, (consumed.get(id) ?? 0) + 1);
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
  };
}
