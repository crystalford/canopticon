// How much of the palette can actually be composed.
//
// THIS FILE IS HAND-WRITTEN AND `registry.ts` IS NOT. The check below used
// to live in the registry, next to the data it reads, which was convenient
// until the registry was regenerated and took the check with it. A
// generated file holds exactly what the generator emits; anything else
// belongs beside it, not inside it.

import { PRIMITIVES, canChain, chainOverwrites } from "./registry.ts";

/** EVERY PRIMITIVE THAT DECLARES AN INPUT AND PAINTS OVER IT.
 *
 *  A STATIC PROPERTY OF THE PALETTE, which is what separates this from
 *  `usage.linkHonesty`. That measures one film — which links a particular
 *  compile happened to use. This asks a question no film is needed to
 *  answer: given a real input of the type it declares, does this
 *  primitive CONSUME it or REPLACE it? The answer cannot change between
 *  compiles, so it can be asked once and acted on.
 *
 *  THE MEASUREMENT: 23 of the 83 primitives that declare an input paint
 *  over it. Twenty-eight per cent of the composable half of the palette
 *  is not composable.
 *
 *  And the correlation explains a 135-primitive palette from which a film
 *  draws 33. The families that never reached a frame were exactly the
 *  families that could not be composed — R · MAPS, L · 3D, N · AUDIO,
 *  Q · CUT GRAMMAR, all of them 100% overwriting. Not a coincidence and
 *  not a scheduling accident: an operator that replaces what it was
 *  applied to deletes the composition and bills for it, so every guard in
 *  the constructor refuses it — silently, because refusing is the correct
 *  answer.
 *
 *  L · 3D is the worked example of the fix. All three of `extrude`,
 *  `layer_peel` and `exploded_view` declared GEOMETRY → something and
 *  drew a hardcoded picture — a glyph reading "1997", four grey sheets,
 *  a stack of isometric diamonds. Each now reads `upstream.paths`, so the
 *  family renders for the first time, and the count of parts is the
 *  geometry's rather than a dial.
 *
 *  Deliberately NOT a throw. A compiler that will not start is worse than
 *  one that is honest about its own palette. Carried onto every compile
 *  report instead, so it is a number on a screen rather than something
 *  someone found once.
 *
 *  It reads `consumesUpstream`, which the generator derives from whether
 *  the lab's `frame()` takes the parameter at all — so a primitive that
 *  takes `upstream` and ignores it still passes. Rerun
 *  `node scripts/gen-primitive-registry.mjs packages/studio/lab` after
 *  touching a primitive or this measures the last build. */
export function overwritingPrimitives(): Array<{ id: string; family: string; fedBy: string }> {
  // One source per payload type, so every consumer can be handed a real
  // input of the kind it says it wants.
  const producer: Record<string, string> = {};
  for (const [id, spec] of Object.entries(PRIMITIVES)) {
    if ((spec.inputs ?? []).length) continue;
    for (const out of spec.outputs ?? []) if (!producer[out]) producer[out] = id;
  }
  const found: Array<{ id: string; family: string; fedBy: string }> = [];
  for (const [id, spec] of Object.entries(PRIMITIVES)) {
    const first = (spec.inputs ?? [])[0];
    if (!first) continue;
    const fedBy = producer[first];
    if (!fedBy || !canChain(fedBy, id)) continue;
    if (chainOverwrites([fedBy, id]).some((o) => o.by === id)) {
      found.push({ id, family: spec.family, fedBy });
    }
  }
  return found;
}
