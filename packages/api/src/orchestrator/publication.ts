// runPublicationGate — fires the publication-bound roles when a thesis
// is promoted to is_public=TRUE.
//
// Roles fired (skills-v1.0 §4–§9):
//   - Tier Projector  : regenerates BLUF / 80 / 800 / Full from current state
//   - Red Team        : finds adversarial objections, writes contradictions
//   - Steelman        : presents the strongest opposing case, writes
//                        load-bearing assumptions
//   - Premortem       : skipped if no predictions exist for this thesis
//
// All four roles require role_definitions.is_active = TRUE for the user.
// Migration 0018 flips them on.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnthropicClient } from "../lib/anthropic.ts";
import { emitEvent } from "./events.ts";
import { invokeRole } from "./role_runner.ts";

export interface RunPublicationGateInput {
  user_id: string;
  thesis_id: string;
  triggered_by: string;
}

export interface RunPublicationGateResult {
  thesis_id: string;
  marked_public: boolean;
  tier_projector: StepOutcome;
  red_team: StepOutcome;
  steelman: StepOutcome;
  errors: string[];
}

type StepOutcome =
  | { status: "completed"; role_invocation_id: string }
  | { status: "denied"; message: string }
  | { status: "skipped"; reason: string }
  | { status: "errored"; message: string };

export interface PublicationContext {
  service: SupabaseClient;
  anthropic: AnthropicClient;
}

export async function runPublicationGate(
  ctx: PublicationContext,
  input: RunPublicationGateInput,
): Promise<RunPublicationGateResult> {
  const result: RunPublicationGateResult = {
    thesis_id: input.thesis_id,
    marked_public: false,
    tier_projector: { status: "skipped", reason: "not run yet" },
    red_team: { status: "skipped", reason: "not run yet" },
    steelman: { status: "skipped", reason: "not run yet" },
    errors: [],
  };

  // Activate the publication-bound roles for this user if they haven't
  // been already. Idempotent — sets is_active=TRUE only when needed.
  await ctx.service
    .from("role_definitions")
    .update({ is_active: true })
    .eq("user_id", input.user_id)
    .in("name", ["tier_projector", "red_team", "steelman"]);

  // Fetch the thesis snapshot we'll feed to each role.
  const snapshot = await fetchPublicationSnapshot(ctx.service, input.user_id, input.thesis_id);
  if (!snapshot) {
    result.errors.push("thesis not found");
    return result;
  }

  // 1. Tier Projector
  result.tier_projector = await runTierProjector(ctx, input, snapshot);

  // 2. Red Team
  result.red_team = await runRedTeam(ctx, input, snapshot);

  // 3. Steelman
  result.steelman = await runSteelman(ctx, input, snapshot);

  // Mark the thesis public.
  const { error } = await ctx.service
    .from("theses")
    .update({ is_public: true })
    .eq("id", input.thesis_id)
    .eq("user_id", input.user_id);
  if (error) {
    result.errors.push(`mark public failed: ${error.message}`);
    return result;
  }
  result.marked_public = true;

  await emitEvent(ctx.service, {
    user_id: input.user_id,
    event_type: "thesis.updated",
    entity_id: input.thesis_id,
    entity_type: "thesis",
    payload: { is_public: true, publication_gate_run: true },
  });

  return result;
}

interface PublicationSnapshot {
  id: string;
  title: string;
  bluf: string | null;
  seed_paragraph: string;
  current_version_id: string | null;
  ipcc_likelihood: string | null;
  claims: Array<{
    id: string;
    layer: string;
    grade: string;
    data: string;
    claim_text: string;
    warrant: string | null;
    qualifier: string | null;
  }>;
}

async function fetchPublicationSnapshot(
  client: SupabaseClient,
  user_id: string,
  thesis_id: string,
): Promise<PublicationSnapshot | null> {
  const { data: thesis } = await client
    .from("theses")
    .select("id, title, current_version_id")
    .eq("id", thesis_id)
    .eq("user_id", user_id)
    .maybeSingle<{ id: string; title: string; current_version_id: string | null }>();
  if (!thesis) return null;

  let bluf: string | null = null;
  let seed_paragraph = "";
  let ipcc_likelihood: string | null = null;
  if (thesis.current_version_id) {
    const { data: version } = await client
      .from("thesis_versions")
      .select("bluf, seed_paragraph, ipcc_likelihood")
      .eq("id", thesis.current_version_id)
      .maybeSingle<{
        bluf: string | null;
        seed_paragraph: string;
        ipcc_likelihood: string | null;
      }>();
    if (version) {
      bluf = version.bluf;
      seed_paragraph = version.seed_paragraph;
      ipcc_likelihood = version.ipcc_likelihood;
    }
  }

  // Integrated claims with their current versions.
  const { data: tcs } = await client
    .from("thesis_claims")
    .select("claim_id, layer")
    .eq("thesis_id", thesis_id)
    .is("removed_at", null);
  const claimIds = (tcs ?? []).map((row) => (row as { claim_id: string }).claim_id);

  const claims: PublicationSnapshot["claims"] = [];
  if (claimIds.length > 0) {
    const { data: claimRows } = await client
      .from("claims")
      .select("id, admiralty_grade, current_version_id")
      .in("id", claimIds);

    const versionIds = (claimRows ?? [])
      .map((row) => (row as { current_version_id: string | null }).current_version_id)
      .filter((v): v is string => Boolean(v));

    const versionsByClaim: Record<
      string,
      { data: string; claim_text: string; warrant: string | null; qualifier: string | null }
    > = {};
    if (versionIds.length > 0) {
      const { data: versions } = await client
        .from("claim_versions")
        .select("claim_id, data, claim_text, warrant, qualifier")
        .in("id", versionIds);
      for (const v of versions ?? []) {
        const row = v as {
          claim_id: string;
          data: string;
          claim_text: string;
          warrant: string | null;
          qualifier: string | null;
        };
        versionsByClaim[row.claim_id] = {
          data: row.data,
          claim_text: row.claim_text,
          warrant: row.warrant,
          qualifier: row.qualifier,
        };
      }
    }

    const layerByClaim: Record<string, string> = {};
    for (const tc of tcs ?? []) {
      const row = tc as { claim_id: string; layer: string };
      layerByClaim[row.claim_id] = row.layer;
    }

    for (const c of claimRows ?? []) {
      const row = c as { id: string; admiralty_grade: string };
      const v = versionsByClaim[row.id];
      if (!v) continue;
      claims.push({
        id: row.id,
        layer: layerByClaim[row.id] ?? "factual",
        grade: row.admiralty_grade,
        data: v.data,
        claim_text: v.claim_text,
        warrant: v.warrant,
        qualifier: v.qualifier,
      });
    }
  }

  return {
    id: thesis.id,
    title: thesis.title,
    bluf,
    seed_paragraph,
    current_version_id: thesis.current_version_id,
    ipcc_likelihood,
    claims,
  };
}

// --- Tier Projector -------------------------------------------------------

async function runTierProjector(
  ctx: PublicationContext,
  input: RunPublicationGateInput,
  snapshot: PublicationSnapshot,
): Promise<StepOutcome> {
  try {
    const inv = await invokeRole(
      { service: ctx.service, anthropic: ctx.anthropic },
      {
        user_id: input.user_id,
        role_name: "tier_projector",
        triggered_by: input.triggered_by,
        snapshot: {
          thesis: {
            id: snapshot.id,
            title: snapshot.title,
            seed_paragraph: snapshot.seed_paragraph,
            ipcc_likelihood: snapshot.ipcc_likelihood ?? "",
          },
          claims: renderClaimsForRole(snapshot.claims),
        },
        estimate: { input_tokens: 2000 + snapshot.claims.length * 200, output_tokens: 4000 },
        approval_context: {
          thesis_id: snapshot.id,
          thesis_title: snapshot.title,
          step: "tier_projector",
        },
      },
    );

    if (inv.status === "denied") {
      return { status: "denied", message: inv.decision.message };
    }

    const structured = (inv.output.structured ?? {}) as {
      bluf?: string;
      tier_80?: string;
      tier_800?: string;
      tier_full?: string;
      ipcc_likelihood?: string;
    };

    // Persist the projected tiers as a new thesis_versions row.
    if (snapshot.current_version_id) {
      const { data: nextNumber } = await ctx.service
        .from("thesis_versions")
        .select("version_number")
        .eq("thesis_id", snapshot.id)
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle<{ version_number: number }>();
      const versionNumber = (nextNumber?.version_number ?? 1) + 1;

      const { data: newVersion } = await ctx.service
        .from("thesis_versions")
        .insert({
          thesis_id: snapshot.id,
          user_id: input.user_id,
          version_number: versionNumber,
          is_current: true,
          seed_paragraph: snapshot.seed_paragraph,
          bluf: structured.bluf ?? snapshot.bluf,
          tier_80: structured.tier_80 ?? null,
          tier_800: structured.tier_800 ?? null,
          tier_full: structured.tier_full ?? null,
          ipcc_likelihood: (structured.ipcc_likelihood ?? snapshot.ipcc_likelihood) || null,
          written_by_role: "tier_projector",
          written_by_role_invocation_id: inv.role_invocation_id,
          change_summary: "tier projection on publication-gate",
        })
        .select("id")
        .single();
      if (newVersion) {
        await ctx.service
          .from("theses")
          .update({ current_version_id: newVersion.id as string })
          .eq("id", snapshot.id);
      }
    }

    return { status: "completed", role_invocation_id: inv.role_invocation_id };
  } catch (err) {
    return { status: "errored", message: (err as Error).message };
  }
}

// --- Red Team -------------------------------------------------------------

async function runRedTeam(
  ctx: PublicationContext,
  input: RunPublicationGateInput,
  snapshot: PublicationSnapshot,
): Promise<StepOutcome> {
  if (snapshot.claims.length === 0) {
    return { status: "skipped", reason: "no integrated claims to attack" };
  }
  try {
    const inv = await invokeRole(
      { service: ctx.service, anthropic: ctx.anthropic },
      {
        user_id: input.user_id,
        role_name: "red_team",
        triggered_by: input.triggered_by,
        snapshot: {
          thesis: {
            id: snapshot.id,
            title: snapshot.title,
            bluf: snapshot.bluf ?? "",
          },
          claims: renderClaimsForRole(snapshot.claims),
          vantage: "ideological-opponent",
        },
        estimate: { input_tokens: 2000 + snapshot.claims.length * 250, output_tokens: 2500 },
        approval_context: {
          thesis_id: snapshot.id,
          thesis_title: snapshot.title,
          step: "red_team",
        },
      },
    );

    if (inv.status === "denied") {
      return { status: "denied", message: inv.decision.message };
    }

    const structured = (inv.output.structured ?? {}) as {
      objections?: Array<{
        target_claim_id?: string;
        objection_text?: string;
        evidence_gap?: string;
        severity?: string;
      }>;
    };

    // Persist each objection as a contradictions row. The contradictions
    // table is created in migration 0017.
    for (const obj of structured.objections ?? []) {
      if (!obj.objection_text) continue;
      await ctx.service.from("contradictions").insert({
        user_id: input.user_id,
        thesis_id: snapshot.id,
        target_claim_id: obj.target_claim_id ?? null,
        objection_text: obj.objection_text,
        evidence_gap: obj.evidence_gap ?? null,
        severity: obj.severity ?? "minor",
        status: "open",
        generated_by: "red_team",
        generated_by_role_invocation_id: inv.role_invocation_id,
      });
    }

    return { status: "completed", role_invocation_id: inv.role_invocation_id };
  } catch (err) {
    return { status: "errored", message: (err as Error).message };
  }
}

// --- Steelman ------------------------------------------------------------

async function runSteelman(
  ctx: PublicationContext,
  input: RunPublicationGateInput,
  snapshot: PublicationSnapshot,
): Promise<StepOutcome> {
  if (snapshot.claims.length === 0) {
    return { status: "skipped", reason: "no integrated claims to steelman against" };
  }
  try {
    const inv = await invokeRole(
      { service: ctx.service, anthropic: ctx.anthropic },
      {
        user_id: input.user_id,
        role_name: "steelman",
        triggered_by: input.triggered_by,
        snapshot: {
          thesis: {
            id: snapshot.id,
            title: snapshot.title,
            bluf: snapshot.bluf ?? "",
          },
          claims: renderClaimsForRole(snapshot.claims),
        },
        estimate: { input_tokens: 2000 + snapshot.claims.length * 250, output_tokens: 2000 },
        approval_context: {
          thesis_id: snapshot.id,
          thesis_title: snapshot.title,
          step: "steelman",
        },
      },
    );

    if (inv.status === "denied") {
      return { status: "denied", message: inv.decision.message };
    }

    const structured = (inv.output.structured ?? {}) as {
      load_bearing_assumptions?: Array<{ text: string; consequence_if_failed?: string }>;
    };

    for (const assumption of structured.load_bearing_assumptions ?? []) {
      if (!assumption.text) continue;
      await ctx.service.from("assumptions").insert({
        user_id: input.user_id,
        thesis_id: snapshot.id,
        text: assumption.text,
        status: "holding",
        is_linchpin: true,
        consequence_if_failed: assumption.consequence_if_failed ?? null,
        last_audit_role_invocation_id: inv.role_invocation_id,
      });
    }

    return { status: "completed", role_invocation_id: inv.role_invocation_id };
  } catch (err) {
    return { status: "errored", message: (err as Error).message };
  }
}

function renderClaimsForRole(claims: PublicationSnapshot["claims"]): string {
  return claims
    .map((c, i) => {
      const w = c.warrant ? `\n  warrant: ${c.warrant}` : "";
      const q = c.qualifier ? `\n  qualifier: ${c.qualifier}` : "";
      return `[${i + 1}] id=${c.id} (${c.layer}, grade ${c.grade}) ${c.claim_text}\n  data: ${c.data}${w}${q}`;
    })
    .join("\n\n");
}
