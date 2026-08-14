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

import { PRIMITIVES, overwritingPrimitives } from "../primitives/registry.ts";
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
  linkHonesty: number | null;
  /** HOW MUCH OF THE FILM DREW NOTHING NEW, 0..1.
   *
   *  Reported beside the measures because without it they mislead. A film
   *  that holds and falls silent genuinely costs less and is genuinely
   *  more deterministic — those are true facts, and read alone on a
   *  dashboard they look like the film got better rather than quieter.
   *
   *  Not a score. A film SHOULD hold; an essay does not need a new picture
   *  every time the narrator opens their mouth. This exists so the two
   *  cases can be told apart, not so one of them can be minimised. */
  heldScenes: number;
  /** GROUNDS — scenes composited from two inputs rather than one.
   *
   *  Counted separately because a ground link is honest by construction:
   *  a compositor reads both of its inputs or it does nothing visible, and
   *  the whole reason this shape exists is that the linear chain could only
   *  express "then". A film with grounds and a film without are different
   *  films, and the number says which one this is. */
  groundedScenes: number;
  /** Every compositor → ground pairing this film used, with counts. */
  grounds: { link: string; uses: number }[];
  /** THE PALETTE'S OWN DEBT, independent of this film.
   *
   *  Everything above measures what THIS compile did. This is a static
   *  property of the palette: how many primitives declare an input and
   *  paint over it when handed one. It cannot change between films, and
   *  it is why so much of the palette is unreachable — an operator that
   *  replaces what it was applied to is correctly refused by every guard
   *  in the constructor, silently, because refusing is right.
   *
   *  Carried on every report so it is a number on a screen rather than
   *  something someone found once. See `overwritingPrimitives`. */
  uncomposable: { count: number; families: { family: string; ids: string[] }[] };
}

/** The uncomposable half of the palette, grouped so it reads as a list
 *  of families to fix rather than as twenty-three unrelated ids. */
function uncomposableDebt(): { count: number; families: { family: string; ids: string[] }[] } {
  const all = overwritingPrimitives();
  const byFamily = new Map<string, string[]>();
  for (const p of all) byFamily.set(p.family, [...(byFamily.get(p.family) ?? []), p.id]);
  return {
    count: all.length,
    families: [...byFamily]
      .map(([family, ids]) => ({ family, ids }))
      .sort((a, b) => b.ids.length - a.ids.length),
  };
}

export function analyseUsage(scenes: ComposedScene[]): UsageReport {
  const uses = new Map<string, number>();
  const consumed = new Map<string, number>();
  const decorative = new Map<string, number>();

  const grounds = new Map<string, number>();
  let groundedScenes = 0;

  for (const scene of scenes) {
    const ids = scene.nodes.map((n) => n.primitiveId);
    // The ground's own primitives are USES like any other — a palette
    // pruned on evidence must not call a primitive unused because it only
    // ever appears on a second input.
    let sceneHasGround = false;
    // RECURSIVE, because an N-plane stack nests one ground inside another.
    // Walking a single level would report the film's deepest layers as
    // unused primitives — and the whole point of this measure is that the
    // palette gets pruned on evidence, so a wrong "never used" here is how
    // a working primitive gets deleted.
    const walkGround = (node: { primitiveId: string; ground?: typeof scene.nodes }) => {
      if (!node.ground || node.ground.length === 0) return;
      for (const g of node.ground) {
        uses.set(g.primitiveId, (uses.get(g.primitiveId) ?? 0) + 1);
        walkGround(g);
      }
      // A ground IS consumed — by the compositor, which reads both sides.
      const tail = node.ground[node.ground.length - 1];
      if (tail) consumed.set(tail.primitiveId, (consumed.get(tail.primitiveId) ?? 0) + 1);
      const link = `${node.ground.map((g) => g.primitiveId).join(" → ")} ⊕ ${node.primitiveId}`;
      grounds.set(link, (grounds.get(link) ?? 0) + 1);
    };
    for (const node of scene.nodes) {
      if (!node.ground || node.ground.length === 0) continue;
      sceneHasGround = true;
      walkGround(node);
    }
    if (sceneHasGround) groundedScenes++;

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
    uncomposable: uncomposableDebt(),
    heldScenes: scenes.filter((sc) => sc.nodes.length === 0 || sc.held === true).length,
    groundedScenes,
    grounds: [...grounds.entries()]
      .map(([link, n]) => ({ link, uses: n }))
      .sort((a, b) => b.uses - a.uses),
  };
}

/** The proportion of this film's chain LINKS that actually carry something.
 *  A film of five-primitive chains where only the last one reads anything is
 *  not five times richer than a film of one — and until this was measured
 *  there was no way to tell those two films apart from the outside. */
function honesty(scenes: ComposedScene[]): number | null {
  let total = 0;
  let real = 0;
  for (const scene of scenes) {
    const ids = scene.nodes.map((n) => n.primitiveId);
    for (let i = 1; i < ids.length; i++) {
      total++;
      if (PRIMITIVES[ids[i] as string]?.consumesUpstream) real++;
    }
    // A ground link counts, and counts as real. The compositor reads both
    // of its inputs — that is what a compositor IS — so a second input is
    // the one link in this palette that cannot be decorative.
    for (const node of scene.nodes) {
      if (!node.ground || node.ground.length === 0) continue;
      total += node.ground.length;
      real += node.ground.length;
    }
  }
  /* NULL, NOT 1. A film with no links anywhere has nothing to be honest
   * or dishonest about, and reporting a perfect score for it is the one
   * outright lie in this file — it would say a film that drew nothing was
   * flawlessly wired. "Not measured" is the true answer. */
  return total === 0 ? null : Math.round((real / total) * 1000) / 1000;
}
