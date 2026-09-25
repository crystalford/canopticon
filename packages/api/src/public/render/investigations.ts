// Investigations — the signed-analysis index + the Library (raw research
// archive). The piece page itself is rendered by piece-template.ts, not
// here — see that file for the public face of a single document.
//
// Split on 2026-09-24 into public/render/library/ (index, upload, rows, leads,
// answered) with the retired signed-analysis index in
// library/retired-investigations.ts. This file is the import path everything
// still uses; it only re-exports.

export * from "./library/index";
export {
  HAS_ANYONE_SAID_THIS_ANGLE,
  renderLeadAnswerForTest,
  renderLeadsForTest,
} from "./library/leads";
export { renderInvestigationsIndex } from "./library/retired-investigations";
