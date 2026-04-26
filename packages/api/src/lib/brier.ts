// Brier scoring helpers, lifted out of routes/predictions.ts so tests
// can hit them directly. Pure functions with no DB dependencies.

export type Outcome = "correct" | "incorrect" | "ambiguous";

/** Brier contribution for a single resolved prediction. */
export function brierContribution(probability: number, outcome: Outcome): number {
  if (outcome === "correct") {
    const err = 1 - probability;
    return Math.round(err * err * 10000) / 10000;
  }
  if (outcome === "incorrect") {
    return Math.round(probability * probability * 10000) / 10000;
  }
  return 0.25;
}

export interface RollingBrierSummary {
  resolved_count: number;
  active_count: number;
  rolling_brier: number | null;
}

/** Aggregate Brier contributions over the operator's prediction set. */
export function computeRollingBrier(
  rows: Array<{ brier_contribution: number | null }>,
): RollingBrierSummary {
  let resolved = 0;
  let active = 0;
  let total = 0;
  for (const row of rows) {
    if (row.brier_contribution !== null && row.brier_contribution !== undefined) {
      resolved++;
      total += Number(row.brier_contribution);
    } else {
      active++;
    }
  }
  return {
    resolved_count: resolved,
    active_count: active,
    rolling_brier: resolved > 0 ? Math.round((total / resolved) * 10000) / 10000 : null,
  };
}
