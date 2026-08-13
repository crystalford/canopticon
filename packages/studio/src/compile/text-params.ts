// Which primitives set type, and what words they should be setting.
//
// THE DEFECT THIS FIXES IS THE WORST ONE IN THE SYSTEM.
//
// Eleven primitives take a `text` or `caption` string parameter, and the
// composition engine never set any of them. So a film compiled from an
// eighty-nine scene investigation rendered `text_stagger`'s default —
// "NOBODY VOTED AGAINST" — thirty-one times, `particle_seek`'s "NINETY
// DAYS" twenty-one times, and `text_layout`'s "THE TEMPORARY MEASURE"
// wherever it appeared, none of which had anything to do with the sentence
// being narrated. The film was showing four hardcoded phrases from a
// different essay, on a loop, for six minutes.
//
// It typechecked. It cached. Every measurement in the Compile view was
// correct about it. Nothing detects this except looking.
//
// TWO RULES.
//
// 1. THE JOIN IS PER-PRIMITIVE, NOT PER-PARAMETER-NAME. Sharing a
//    parameter name is not sharing a meaning — the same mistake that sent
//    a shot's deformation `amount` to `document_surface`, which happens to
//    have a parameter of that name.
//
// 2. TYPE IS NOT NARRATION. A frame showing a whole sentence in 46px is a
//    caption, not a design, and it is unreadable at documentary pace. What
//    goes on screen is the PHRASE the scene is about — which is what a
//    person writing a shot list would have written, and what the segmenter
//    already computes as the scene's label.

/** Primitives that put words on screen, and the parameters that carry them.
 *  A primitive not on this list gets no text, which is the honest default:
 *  better a primitive using its own placeholder than one silently handed a
 *  string it will lay out wrongly. */
export const TEXT_TARGETS: Record<string, string[]> = {
  text_layout: ["text"],
  text_stagger: ["text"],
  text_stagger_units: ["text"],
  text_scramble: ["text"],
  text_morph: ["from", "to"],
  glyph_to_path: ["text"],
  glyph_to_points: ["text"],
  glyph_geometry: ["text"],
  variable_axis: ["text"],
  particle_seek: ["text"],
  annotation: ["label"],
  data_series: ["caption"],
  // The masthead of a constructed document. Without it the GROUNDED rung —
  // a documentary's most literal register — was the same newspaper page
  // twenty-one times.
  document_layout: ["heading"],
};

/** Words short enough to be typography rather than a caption.
 *
 *  A documentary scene holds for a few seconds; a full sentence set large
 *  enough to read is a wall. The label the segmenter already derived is the
 *  first few strong words of the sentence, which is exactly the unit a
 *  title card wants. This trims further and upper-cases, because every
 *  primitive here draws in a display face. */
export function displayPhrase(label: string, sentence: string, max = 26): string {
  const source = (label || sentence || "").trim();
  if (source.length <= max) return source.toUpperCase();
  // Cut on a word boundary rather than mid-word — a clipped word reads as a
  // rendering bug, and the whole point is that this looks authored.
  const cut = source.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut).toUpperCase();
}

/** Apply a scene's words to whichever primitives in its chain set type.
 *  Returns only the parameters that belong to THIS primitive, so a caller
 *  can merge them without having to know the table. */
export function textParamsFor(
  primitiveId: string,
  phrase: string,
  declared: Record<string, unknown>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of TEXT_TARGETS[primitiveId] ?? []) {
    // Belt and braces: the primitive must be on the list AND actually
    // declare the parameter, so a renamed parameter shows up as type that
    // stops changing rather than as a silently ignored write.
    if (declared[key] === undefined) continue;
    out[key] = phrase;
  }
  return out;
}
