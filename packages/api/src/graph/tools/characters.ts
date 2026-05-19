// Character chat tools — operator-facing wrappers for the character
// pipeline. Six tools:
//   - seed_character_from_wikipedia  (confirm)  — promote + seed
//   - promote_to_character           (confirm)  — manual promote, no bio
//   - demote_character               (confirm)  — clears is_character flag
//   - list_pending_proposals         (auto)     — read-only review queue
//   - approve_proposal               (confirm)  — apply a pending proposal
//   - reject_proposal                (confirm)  — drop a pending proposal

import { all, insertOne, one, parseJson, run } from "../../lib/d1";
import { demoteCharacter, promoteToCharacter, seedCharacterFromWikipedia } from "../lib/character";
import type { ToolDef } from "./index";

const seedFromWiki: ToolDef = {
  name: "seed_character_from_wikipedia",
  description:
    "Promote a person entity to a first-class character profile and seed the bio + timeline from Wikipedia. Falls back to a minimal profile if Wikipedia has no match. Idempotent — re-seeding refreshes the bio.",
  input_schema: {
    type: "object",
    properties: {
      entity_id: { type: "string", description: "Person entity to promote." },
      entity_name: {
        type: "string",
        description: "Alternative to entity_id — looked up by canonical_name.",
      },
      wikipedia_title: {
        type: "string",
        description: "Exact Wikipedia page title to use. Omit to auto-detect.",
      },
    },
  },
  confirm: true,
  async exec({ env, userId }, input) {
    const entity = await resolveEntity(env, userId, input);
    if (!entity) return { output: "No matching person entity.", side_effects: [] };
    const wikiTitle = input.wikipedia_title as string | undefined;
    const result = await seedCharacterFromWikipedia(
      env,
      userId,
      entity.id,
      wikiTitle ? { wikipediaTitle: wikiTitle } : {},
    );
    const route = `/characters/${result.slug}`;
    return {
      output:
        `Seeded character **${entity.canonical_name}** from ${result.source}.\n` +
        `- Profile slug: ${result.slug}\n` +
        `- Timeline events seeded: ${result.timeline_events_count}\n` +
        `- Operator view: ${route}\n` +
        `- Public page: /p/characters/${result.slug}`,
      side_effects: [{ kind: "entity", id: entity.id, summary: entity.canonical_name }],
    };
  },
};

const promote: ToolDef = {
  name: "promote_to_character",
  description:
    "Mark a person entity as a first-class character without seeding any bio content. Use when Wikipedia has no match and you'll fill the bio in manually.",
  input_schema: {
    type: "object",
    properties: {
      entity_id: { type: "string" },
      entity_name: { type: "string" },
    },
  },
  confirm: true,
  async exec({ env, userId }, input) {
    const entity = await resolveEntity(env, userId, input);
    if (!entity) return { output: "No matching person entity.", side_effects: [] };
    const result = await promoteToCharacter(env, userId, entity.id);
    return {
      output:
        `Promoted **${entity.canonical_name}** to character (slug: ${result.slug}).\n` +
        `No bio seeded — edit at /characters/${result.slug}.`,
      side_effects: [{ kind: "entity", id: entity.id, summary: entity.canonical_name }],
    };
  },
};

const demote: ToolDef = {
  name: "demote_character",
  description:
    "Remove the character flag from an entity. Keeps the profile row and timeline so the work isn't lost; the public page goes offline.",
  input_schema: {
    type: "object",
    properties: {
      entity_id: { type: "string" },
      entity_name: { type: "string" },
    },
  },
  confirm: true,
  async exec({ env, userId }, input) {
    const entity = await resolveEntity(env, userId, input);
    if (!entity) return { output: "No matching entity.", side_effects: [] };
    await demoteCharacter(env, userId, entity.id);
    return {
      output: `Demoted **${entity.canonical_name}**. Profile is retained but no longer public.`,
      side_effects: [{ kind: "entity", id: entity.id, summary: entity.canonical_name }],
    };
  },
};

const listProposals: ToolDef = {
  name: "list_pending_proposals",
  description:
    "List pending character update proposals (timeline events, bio revisions, role changes). Filter by character_id or character_name; omit both to list across all characters.",
  input_schema: {
    type: "object",
    properties: {
      character_id: { type: "string" },
      character_name: { type: "string" },
      limit: { type: "integer", minimum: 1, maximum: 100 },
    },
  },
  confirm: false,
  async exec({ env, userId }, input) {
    let entityId: string | null = null;
    if (input.character_id || input.character_name) {
      const entity = await resolveEntity(env, userId, {
        entity_id: input.character_id as string | undefined,
        entity_name: input.character_name as string | undefined,
      });
      if (entity) entityId = entity.id;
    }
    const limit = Math.min(Number(input.limit ?? 25), 100);
    const proposals = await all<{
      id: string;
      entity_id: string;
      kind: string;
      proposed_payload: string;
      rationale: string | null;
      source_claim_ids: string;
      created_at: string;
      canonical_name: string;
    }>(
      env.DB,
      entityId
        ? `SELECT cup.id, cup.entity_id, cup.kind, cup.proposed_payload, cup.rationale,
                  cup.source_claim_ids, cup.created_at, cp.canonical_name
             FROM character_update_proposals cup
             JOIN character_profiles cp ON cp.entity_id = cup.entity_id
            WHERE cup.entity_id = ? AND cup.status = 'pending'
            ORDER BY cup.created_at DESC LIMIT ?`
        : `SELECT cup.id, cup.entity_id, cup.kind, cup.proposed_payload, cup.rationale,
                  cup.source_claim_ids, cup.created_at, cp.canonical_name
             FROM character_update_proposals cup
             JOIN character_profiles cp ON cp.entity_id = cup.entity_id
            WHERE cp.user_id = ? AND cup.status = 'pending'
            ORDER BY cup.created_at DESC LIMIT ?`,
      entityId ? [entityId, limit] : [userId, limit],
    );
    if (proposals.length === 0) {
      return { output: "No pending proposals.", side_effects: [] };
    }
    const lines = proposals.map((p) => {
      const payload = parseJson<Record<string, unknown>>(p.proposed_payload, {});
      let summary = "";
      if (p.kind === "timeline_event") {
        summary = `${payload.event_date} — ${payload.event_title}`;
      } else if (p.kind === "role_change") {
        summary = `${payload.from_role ?? "?"} → ${payload.to_role}`;
      } else {
        summary = String(payload.paragraph_md ?? "").slice(0, 80);
      }
      return `- [${p.id}] **${p.canonical_name}** · ${p.kind} · ${summary}${p.rationale ? `\n  _${p.rationale}_` : ""}`;
    });
    return { output: lines.join("\n"), side_effects: [] };
  },
};

const approve: ToolDef = {
  name: "approve_proposal",
  description:
    "Approve a pending character update proposal. Applies it to the character profile (timeline event, bio paragraph, or role change).",
  input_schema: {
    type: "object",
    properties: {
      proposal_id: { type: "string" },
    },
    required: ["proposal_id"],
  },
  confirm: true,
  async exec({ env, userId }, input) {
    const proposalId = String(input.proposal_id);
    const proposal = await one<{
      id: string;
      entity_id: string;
      kind: string;
      proposed_payload: string;
      source_claim_ids: string;
      status: string;
    }>(
      env.DB,
      `SELECT cup.id, cup.entity_id, cup.kind, cup.proposed_payload,
              cup.source_claim_ids, cup.status
         FROM character_update_proposals cup
         JOIN character_profiles cp ON cp.entity_id = cup.entity_id
        WHERE cup.id = ? AND cp.user_id = ?`,
      [proposalId, userId],
    );
    if (!proposal) return { output: "Proposal not found.", side_effects: [] };
    if (proposal.status !== "pending") {
      return { output: `Proposal already ${proposal.status}.`, side_effects: [] };
    }
    const payload = parseJson<Record<string, unknown>>(proposal.proposed_payload, {});
    const sourceClaimIds = parseJson<string[]>(proposal.source_claim_ids, []);

    if (proposal.kind === "timeline_event") {
      await insertOne(env.DB, "character_timeline_events", {
        entity_id: proposal.entity_id,
        event_date: String(payload.event_date ?? ""),
        event_title: String(payload.event_title ?? ""),
        event_body: (payload.event_body as string | undefined) ?? null,
        source_claim_ids: sourceClaimIds,
        significance: String(payload.significance ?? "context"),
        status: "confirmed",
        proposed_by: "agent",
        reviewed_at: new Date().toISOString(),
      });
    } else if (proposal.kind === "bio_revision") {
      const profile = await one<{ id: string; bio_md: string; version_count: number }>(
        env.DB,
        "SELECT id, bio_md, version_count FROM character_profiles WHERE entity_id = ?",
        [proposal.entity_id],
      );
      if (profile) {
        const newBody = `${profile.bio_md.trim()}\n\n${String(payload.paragraph_md ?? "")}`;
        const nextVersion = (profile.version_count ?? 0) + 1;
        await insertOne(env.DB, "character_profile_versions", {
          entity_id: proposal.entity_id,
          version_number: nextVersion,
          bio_md: newBody,
          change_summary: `Approved proposal ${proposal.id}`,
        });
        await run(
          env.DB,
          "UPDATE character_profiles SET bio_md = ?, version_count = ?, updated_at = ? WHERE id = ?",
          [newBody, nextVersion, new Date().toISOString(), profile.id],
        );
      }
    } else if (proposal.kind === "role_change") {
      await run(
        env.DB,
        "UPDATE character_profiles SET current_role = ?, updated_at = ? WHERE entity_id = ?",
        [String(payload.to_role ?? ""), new Date().toISOString(), proposal.entity_id],
      );
    }
    await run(
      env.DB,
      "UPDATE character_update_proposals SET status = 'approved', reviewed_at = ? WHERE id = ?",
      [new Date().toISOString(), proposalId],
    );
    return {
      output: `Approved ${proposal.kind} proposal ${proposalId}.`,
      side_effects: [{ kind: "entity", id: proposal.entity_id, summary: proposal.kind }],
    };
  },
};

const reject: ToolDef = {
  name: "reject_proposal",
  description: "Reject a pending character update proposal. Does not modify the profile.",
  input_schema: {
    type: "object",
    properties: {
      proposal_id: { type: "string" },
      reason: { type: "string" },
    },
    required: ["proposal_id"],
  },
  confirm: true,
  async exec({ env, userId }, input) {
    const proposalId = String(input.proposal_id);
    const owned = await one(
      env.DB,
      `SELECT cup.id FROM character_update_proposals cup
         JOIN character_profiles cp ON cp.entity_id = cup.entity_id
        WHERE cup.id = ? AND cp.user_id = ?`,
      [proposalId, userId],
    );
    if (!owned) return { output: "Proposal not found.", side_effects: [] };
    await run(
      env.DB,
      "UPDATE character_update_proposals SET status = 'rejected', reviewed_at = ? WHERE id = ?",
      [new Date().toISOString(), proposalId],
    );
    return {
      output: `Rejected proposal ${proposalId}${input.reason ? ` (${input.reason})` : ""}.`,
      side_effects: [],
    };
  },
};

async function resolveEntity(
  env: { DB: D1Database },
  userId: string,
  input: { entity_id?: unknown; entity_name?: unknown },
): Promise<{ id: string; canonical_name: string } | null> {
  if (input.entity_id) {
    return await one<{ id: string; canonical_name: string }>(
      env.DB,
      "SELECT id, canonical_name FROM entities WHERE id = ? AND user_id = ?",
      [String(input.entity_id), userId],
    );
  }
  if (input.entity_name) {
    return await one<{ id: string; canonical_name: string }>(
      env.DB,
      "SELECT id, canonical_name FROM entities WHERE user_id = ? AND lower(canonical_name) = lower(?) LIMIT 1",
      [userId, String(input.entity_name)],
    );
  }
  return null;
}

export const CHARACTER_TOOLS: ToolDef[] = [
  seedFromWiki,
  promote,
  demote,
  listProposals,
  approve,
  reject,
];
