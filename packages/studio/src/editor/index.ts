// THE EDITOR, ASSEMBLED. Model first, rules always available.
//
// Standing rule 8 — degrade, flag, continue — expressed structurally: this
// function cannot fail. It returns an editorial reading in every case, and
// it always says which kind it is, so a rules reading can never be mistaken
// for the model's.

import type { EditorialModel, Film } from "../film/schema.ts";
import { hashRecord } from "../lib/hash.ts";
import { EDITOR_MODEL, PROMPT_VERSION, callEditor } from "./model.ts";
import { readEssayStructurally } from "./rules.ts";
import { verifyEditorial } from "./verify.ts";

interface AiBinding {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
}

export interface EditorialResult {
  editorial: EditorialModel;
  editorialHash: string;
  provenance: Film["editorialProvenance"];
  notes: string[];
}

export async function analyseEssay(
  ai: AiBinding | undefined,
  essay: string,
): Promise<EditorialResult> {
  const createdAt = new Date().toISOString();
  const notes: string[] = [];

  const call = await callEditor(ai, essay);
  if (call.ok) {
    const checked = verifyEditorial(call.json, essay);
    notes.push(...checked.notes);
    if (!checked.declined) {
      return {
        editorial: checked.editorial,
        editorialHash: await hashRecord(checked.editorial),
        provenance: {
          source: "model",
          model: call.model ?? EDITOR_MODEL,
          promptVersion: PROMPT_VERSION,
          createdAt,
          rejectedPhrases: checked.rejectedPhrases,
        },
        notes,
      };
    }
    // Verified and found wanting. This is a real outcome, not an error —
    // and the reason it is worth having is that the alternative is a film
    // whose words the essay never contained.
    const editorial = readEssayStructurally(essay);
    return {
      editorial,
      editorialHash: await hashRecord(editorial),
      provenance: {
        source: "rules",
        promptVersion: PROMPT_VERSION,
        createdAt,
        declineReason: "unverified",
        rejectedPhrases: checked.rejectedPhrases,
      },
      notes,
    };
  }

  for (const a of call.attempts) notes.push(`${a.model}: ${a.outcome}`);
  const editorial = readEssayStructurally(essay);
  return {
    editorial,
    editorialHash: await hashRecord(editorial),
    provenance: {
      source: "rules",
      promptVersion: PROMPT_VERSION,
      createdAt,
      declineReason: call.reason ?? "call-failed",
      rejectedPhrases: 0,
    },
    notes,
  };
}

/** What the UI says about a reading. The distinction must always be
 *  visible: an operator looking at a thin film deserves to know whether
 *  the model read it or a regex did. */
export function describeProvenance(p: Film["editorialProvenance"]): string {
  if (p.source === "model") {
    const dropped = p.rejectedPhrases > 0 ? `, ${p.rejectedPhrases} invented phrases dropped` : "";
    return `read by ${p.model ?? "the model"}${dropped}`;
  }
  const why =
    p.declineReason === "no-binding"
      ? "the model was not available"
      : p.declineReason === "unverified"
        ? "the model's reading did not survive verification"
        : "the model did not answer";
  return `read structurally — ${why}`;
}

export { readEssayStructurally } from "./rules.ts";
