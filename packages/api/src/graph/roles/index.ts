// Graph roles — the 8 AI personalities from the system spec.
//
// Each file exports its prompt + schema + an exec function. They're
// in-code (not driven by role_definitions table rows). The existing
// 18-role DB-driven runner (graph/lib/role-runner.ts) stays in place
// for back-compat until Phase 6.5 consolidates the runtime — operators
// who relied on the deeper analytical roles (red_team, premortem,
// calibration, etc.) keep them.
//
// Roles in this directory ARE wired:
//   - extractor → called from IngestWorkflow on every source ingest
//   - critic    → called from chat tool run_critic
//   - citer     → called from chat tool query_substrate
//   - predictor → called from chat tool bank_prediction
//
// Roles in this directory are AVAILABLE but not yet wired to chat:
//   - synthesist           (draft_thesis chat tool — wire in Phase 7)
//   - ingestion-critic     (replaces DB role of same name — Phase 6.5)
//   - thesis-proposer      (propose_theses chat tool — Phase 7)
//   - contradiction-finder (surface_contradictions chat tool — Phase 7)

export { extract, EXTRACTOR_PROMPT, EXTRACT_SCHEMA } from "./extractor";
export type { ExtractedClaim, ExtractedEntity, ExtractResult } from "./extractor";

export { synthesize } from "./synthesist";
export type { SynthesizeArgs } from "./synthesist";

export { critique } from "./critic";
export type { CritiqueResult } from "./critic";

export { cite } from "./citer";
export type { CiterArgs } from "./citer";

export { parsePrediction } from "./predictor";
export type { ParsedPrediction } from "./predictor";

export { gradeSource } from "./ingestion-critic";
export type { GradingResult } from "./ingestion-critic";

export { proposeTheses } from "./thesis-proposer";
export type { ThesisProposal, ProposeArgs } from "./thesis-proposer";

export { findContradictions } from "./contradiction-finder";
export type { ContradictionPair, FindArgs } from "./contradiction-finder";
