// Tool registry for the chat agent.
//
// Each entry has:
//   - name, description, input_schema: surfaced to the model
//   - confirm: true if the operator must approve before commit
//   - exec: server-side executor that mutates the substrate
//
// "Auto reads, confirm writes" — see the plan for the policy.

import type { Env } from "../../env";
import { all, insertOne, one, parseJson } from "../../lib/d1";
import { embedText, searchVectors, upsertVector, vectorId } from "../lib/embeddings";
import { extractUpload, extractUrl } from "../lib/extract";
import { runRole } from "../lib/role-runner";
import { seedExamples } from "../lib/seed-examples";
import { CHARACTER_TOOLS } from "./characters";
import { WEB_RESEARCH_TOOLS } from "./web_research";

export interface ToolSideEffect {
  kind: "entity" | "claim" | "thesis" | "source" | "role_invocation" | "upload" | "post";
  id: string;
  summary: string;
}

export interface ToolResult {
  output: string; // model-facing text (markdown / JSON-as-string)
  side_effects: ToolSideEffect[];
}

export interface ToolContext {
  env: Env;
  userId: string;
  conversationId: string;
}

export interface ToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  confirm: boolean;
  exec: (ctx: ToolContext, input: Record<string, unknown>) => Promise<ToolResult>;
}

// ---------------------------------------------------------------------------
// Read tools (auto-execute)
// ---------------------------------------------------------------------------

const search_substrate: ToolDef = {
  name: "search_substrate",
  description:
    "Semantic + keyword search across the operator's substrate (entities, claims, articles, theses, sources). Returns top hits with snippets.",
  input_schema: {
    type: "object",
    properties: {
      q: { type: "string" },
      kinds: {
        type: "array",
        items: { enum: ["entity", "claim", "article", "thesis", "source"] },
      },
      top_k: { type: "integer", minimum: 1, maximum: 25 },
    },
    required: ["q"],
  },
  confirm: false,
  async exec({ env, userId }, input) {
    const q = String(input.q ?? "");
    const top_k = Math.min(Number(input.top_k ?? 12), 25);
    const kinds = Array.isArray(input.kinds)
      ? (input.kinds as Array<"entity" | "claim" | "article" | "thesis" | "source">)
      : undefined;
    const hits = await searchVectors(env, { query: q, userId, topK: top_k, kinds });
    if (hits.length === 0) {
      return { output: "No matches.", side_effects: [] };
    }
    const lines = hits.map(
      (h) =>
        `- [${h.metadata.kind}] ${h.metadata.title ?? h.metadata.id} (score=${h.score.toFixed(3)})`,
    );
    return { output: lines.join("\n"), side_effects: [] };
  },
};

const query_graph: ToolDef = {
  name: "query_graph",
  description: "Look up an entity by id or name and return its 1-hop neighborhood.",
  input_schema: {
    type: "object",
    properties: {
      entity_id: { type: "string" },
      name: { type: "string" },
    },
  },
  confirm: false,
  async exec({ env, userId }, input) {
    let entity = input.entity_id
      ? await one<{ id: string; canonical_name: string; entity_type: string }>(
          env.DB,
          "SELECT id, canonical_name, entity_type FROM entities WHERE id = ? AND user_id = ?",
          [String(input.entity_id), userId],
        )
      : null;
    if (!entity && input.name) {
      entity = await one(
        env.DB,
        `SELECT id, canonical_name, entity_type FROM entities
         WHERE user_id = ? AND lower(canonical_name) = lower(?) LIMIT 1`,
        [userId, String(input.name)],
      );
    }
    if (!entity) return { output: "No matching entity.", side_effects: [] };
    const relations = await all<{
      from_entity_id: string;
      to_entity_id: string;
      relation_type: string;
    }>(
      env.DB,
      `SELECT from_entity_id, to_entity_id, relation_type FROM entity_relations
       WHERE user_id = ? AND (from_entity_id = ? OR to_entity_id = ?) LIMIT 50`,
      [userId, entity.id, entity.id],
    );
    return {
      output: JSON.stringify({ entity, relations }, null, 2),
      side_effects: [],
    };
  },
};

const read_file: ToolDef = {
  name: "read_file",
  description: "Read an uploaded file's extracted text. Triggers extraction if pending.",
  input_schema: {
    type: "object",
    properties: { file_id: { type: "string" } },
    required: ["file_id"],
  },
  confirm: false,
  async exec({ env, userId }, input) {
    const file = await one<{
      id: string;
      extraction_status: string;
      extracted_text: string | null;
      extracted_summary: string | null;
      created_source_id: string | null;
      original_filename: string;
    }>(
      env.DB,
      `SELECT id, extraction_status, extracted_text, extracted_summary, created_source_id, original_filename
       FROM uploaded_files WHERE id = ? AND user_id = ?`,
      [String(input.file_id), userId],
    );
    if (!file) return { output: "File not found.", side_effects: [] };
    if (file.extraction_status === "pending") {
      await extractUpload(env, file.id);
      return exec_read_again(env, userId, file.id);
    }
    return {
      output: `# ${file.original_filename}\n\n${file.extracted_summary ?? ""}\n\n${file.extracted_text ?? ""}`,
      side_effects: file.created_source_id
        ? [{ kind: "source", id: file.created_source_id, summary: file.original_filename }]
        : [],
    };
  },
};

async function exec_read_again(env: Env, userId: string, fileId: string): Promise<ToolResult> {
  const f = await one<{
    extracted_text: string | null;
    extracted_summary: string | null;
    created_source_id: string | null;
    original_filename: string;
  }>(
    env.DB,
    `SELECT extracted_text, extracted_summary, created_source_id, original_filename
     FROM uploaded_files WHERE id = ? AND user_id = ?`,
    [fileId, userId],
  );
  if (!f) return { output: "File vanished.", side_effects: [] };
  return {
    output: `# ${f.original_filename}\n\n${f.extracted_summary ?? ""}\n\n${f.extracted_text ?? ""}`,
    side_effects: f.created_source_id
      ? [{ kind: "source", id: f.created_source_id, summary: f.original_filename }]
      : [],
  };
}

const fetch_url: ToolDef = {
  name: "fetch_url",
  description:
    "Fetch a URL, strip HTML to readable text, store it as an uploaded file, and create a pending_critic source.",
  input_schema: {
    type: "object",
    properties: { url: { type: "string", format: "uri" } },
    required: ["url"],
  },
  confirm: false,
  async exec({ env, userId }, input) {
    const url = String(input.url ?? "");
    if (!/^https?:\/\//.test(url)) {
      return { output: "URL must be http(s).", side_effects: [] };
    }
    const result = await extractUrl(env, userId, url);
    return {
      output: `Fetched ${url}. Created source ${result.source_id} (${result.extracted_chars} chars).`,
      side_effects: [{ kind: "source", id: result.source_id, summary: url }],
    };
  },
};

// ---------------------------------------------------------------------------
// Queue-only tools (auto-execute — they only enqueue work for downstream gates)
// ---------------------------------------------------------------------------

const create_source: ToolDef = {
  name: "create_source",
  description:
    "Create a pending source from text the operator pasted. Ingestion critic will grade it asynchronously.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      source_type: {
        enum: [
          "hansard",
          "news",
          "social",
          "video",
          "book",
          "filing",
          "report",
          "operator_note",
          "other",
        ],
      },
      url: { type: "string" },
      content_text: { type: "string" },
      authors: { type: "array", items: { type: "string" } },
      published_at: { type: "string" },
    },
    required: ["title", "source_type"],
  },
  confirm: false,
  async exec({ env, userId }, input) {
    const id = await insertOne(env.DB, "sources", {
      user_id: userId,
      source_type: String(input.source_type),
      ingestion_state: "pending_critic",
      title: String(input.title),
      url: input.url ?? null,
      content_text: input.content_text ?? null,
      authors: input.authors ?? [],
      published_at: input.published_at ?? null,
      ingested_via: "chat_agent",
    });
    return {
      output: `Created source ${id} (pending critic).`,
      side_effects: [{ kind: "source", id, summary: String(input.title) }],
    };
  },
};

const run_role_tool: ToolDef = {
  name: "run_role",
  description:
    "Run one of the 18 forensic roles. Routes by role_definitions.provider/model (free Workers AI by default).",
  input_schema: {
    type: "object",
    properties: {
      role_name: {
        enum: [
          "ingestion_critic",
          "verifier",
          "interrogator",
          "red_team",
          "steelman",
          "premortem",
          "gap_surfacer",
          "calibration",
          "tier_projector",
          "assumption_auditor",
          "indicator_validator",
          "novelty_surfacer",
          "claim_extraction",
          "entity_resolver",
          "claim_deduplicator",
          "solution_inventory_builder",
          "argument_mapper",
          "genealogy_tracer",
        ],
      },
      payload: { type: "object" },
    },
    required: ["role_name", "payload"],
  },
  confirm: false,
  async exec({ env, userId }, input) {
    const result = await runRole(env, {
      userId,
      roleName: String(input.role_name),
      payload: (input.payload as Record<string, unknown>) ?? {},
    });
    return {
      output:
        result.status === "completed"
          ? `Role ${input.role_name} completed in ${result.duration_ms}ms.\n\n${JSON.stringify(result.output, null, 2)}`
          : `Role ${input.role_name} failed: ${result.error}`,
      side_effects: [
        { kind: "role_invocation", id: result.invocation_id, summary: String(input.role_name) },
      ],
    };
  },
};

const extract_entities: ToolDef = {
  name: "extract_entities",
  description:
    "Propose entities + relations from a text snippet. Returns proposals; does NOT commit. Use commit_entities to persist.",
  input_schema: {
    type: "object",
    properties: {
      text: { type: "string" },
      source_id: { type: "string" },
    },
    required: ["text"],
  },
  confirm: false,
  async exec({ env, userId }, input) {
    const role = await runRole(env, {
      userId,
      roleName: "entity_resolver",
      payload: { text: String(input.text), source_id: input.source_id ?? null },
    });
    return {
      output: JSON.stringify(role.output ?? {}, null, 2),
      side_effects: [
        { kind: "role_invocation", id: role.invocation_id, summary: "entity proposals" },
      ],
    };
  },
};

// ---------------------------------------------------------------------------
// Write tools (CONFIRM before executing)
// ---------------------------------------------------------------------------

const commit_entities: ToolDef = {
  name: "commit_entities",
  description:
    "Persist entity + relation proposals to the substrate. Requires operator confirmation.",
  input_schema: {
    type: "object",
    properties: {
      entities: {
        type: "array",
        items: {
          type: "object",
          properties: {
            canonical_name: { type: "string" },
            entity_type: { type: "string" },
            aliases: { type: "array", items: { type: "string" } },
          },
          required: ["canonical_name", "entity_type"],
        },
      },
      relations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            from_name: { type: "string" },
            to_name: { type: "string" },
            relation_type: { type: "string" },
            strength: { type: "number" },
          },
          required: ["from_name", "to_name", "relation_type"],
        },
      },
    },
    required: ["entities"],
  },
  confirm: true,
  async exec({ env, userId }, input) {
    const entities = (input.entities ?? []) as Array<{
      canonical_name: string;
      entity_type: string;
      aliases?: string[];
    }>;
    const relations = (input.relations ?? []) as Array<{
      from_name: string;
      to_name: string;
      relation_type: string;
      strength?: number;
    }>;
    const idByName = new Map<string, string>();
    const sideEffects: ToolSideEffect[] = [];

    for (const e of entities) {
      const existing = await one<{ id: string }>(
        env.DB,
        "SELECT id FROM entities WHERE user_id = ? AND lower(canonical_name) = lower(?) LIMIT 1",
        [userId, e.canonical_name],
      );
      let id: string;
      if (existing) {
        id = existing.id;
      } else {
        id = await insertOne(env.DB, "entities", {
          user_id: userId,
          canonical_name: e.canonical_name,
          entity_type: e.entity_type,
          aliases: e.aliases ?? [],
        });
        try {
          const values = await embedText(env, `${e.canonical_name} (${e.entity_type})`);
          await upsertVector(env, {
            id: vectorId("entity", id),
            values,
            metadata: { user_id: userId, kind: "entity", id, title: e.canonical_name },
          });
        } catch {
          // non-fatal
        }
      }
      idByName.set(e.canonical_name.toLowerCase(), id);
      sideEffects.push({ kind: "entity", id, summary: e.canonical_name });
    }

    for (const r of relations) {
      const from = idByName.get(r.from_name.toLowerCase());
      const to = idByName.get(r.to_name.toLowerCase());
      if (!from || !to) continue;
      await insertOne(env.DB, "entity_relations", {
        user_id: userId,
        from_entity_id: from,
        to_entity_id: to,
        relation_type: r.relation_type,
        strength: r.strength ?? 0.5,
      });
    }

    return {
      output: `Committed ${entities.length} entities and ${relations.length} relations.`,
      side_effects: sideEffects,
    };
  },
};

const create_claim: ToolDef = {
  name: "create_claim",
  description: "Create a Toulmin-structured claim. Requires operator confirmation.",
  input_schema: {
    type: "object",
    properties: {
      source_id: { type: "string" },
      layer: { enum: ["empirical", "causal", "evaluative", "normative", "predictive"] },
      claim_text: { type: "string" },
      data: { type: "string" },
      warrant: { type: "string" },
      backing: { type: "string" },
      qualifier: { type: "string" },
      rebuttal: { type: "string" },
    },
    required: ["source_id", "layer", "claim_text", "data", "warrant", "qualifier"],
  },
  confirm: true,
  async exec({ env, userId }, input) {
    const id = await insertOne(env.DB, "claims", {
      user_id: userId,
      claim_text: String(input.claim_text),
      layer: String(input.layer),
      data: String(input.data),
      warrant: String(input.warrant),
      backing: input.backing ?? null,
      qualifier: String(input.qualifier),
      rebuttal: input.rebuttal ?? null,
    });
    await insertOne(env.DB, "claim_sources", {
      claim_id: id,
      source_id: String(input.source_id),
      user_id: userId,
    });
    try {
      const values = await embedText(env, String(input.claim_text));
      await upsertVector(env, {
        id: vectorId("claim", id),
        values,
        metadata: {
          user_id: userId,
          kind: "claim",
          id,
          title: String(input.claim_text).slice(0, 80),
        },
      });
    } catch {
      // non-fatal
    }
    return {
      output: `Created claim ${id}.`,
      side_effects: [{ kind: "claim", id, summary: String(input.claim_text).slice(0, 80) }],
    };
  },
};

const create_thesis: ToolDef = {
  name: "create_thesis",
  description: "Create a thesis (research thread). Requires operator confirmation.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      seed_summary: { type: "string" },
    },
    required: ["title", "seed_summary"],
  },
  confirm: true,
  async exec({ env, userId }, input) {
    const id = await insertOne(env.DB, "theses", {
      user_id: userId,
      title: String(input.title),
      seed_summary: String(input.seed_summary),
    });
    try {
      const values = await embedText(env, `${input.title}\n${input.seed_summary}`);
      await upsertVector(env, {
        id: vectorId("thesis", id),
        values,
        metadata: { user_id: userId, kind: "thesis", id, title: String(input.title) },
      });
    } catch {
      // non-fatal
    }
    return {
      output: `Created thesis ${id}.`,
      side_effects: [{ kind: "thesis", id, summary: String(input.title) }],
    };
  },
};

const seed_example_content: ToolDef = {
  name: "seed_example_content",
  description:
    "Seed the substrate with three short public-domain articles and run the ingestion pipeline. Use this on first login to populate Live/Graph/Library/Sources.",
  input_schema: {
    type: "object",
    properties: { topic: { type: "string" } },
  },
  confirm: true,
  async exec({ env, userId }, _input) {
    const result = await seedExamples(env, userId);
    return {
      output: `Seeded ${result.sources.length} sources. Sources: ${result.sources.map((s) => s.title).join("; ")}.`,
      side_effects: result.sources.map((s) => ({
        kind: "source" as const,
        id: s.id,
        summary: s.title,
      })),
    };
  },
};

// note_finding: used by the watcher agent (and available to chat) to log
// a short observation as an orchestrator_event for the Live screen. No
// substrate mutation beyond the event row.
const note_finding: ToolDef = {
  name: "note_finding",
  description:
    "Log a short observation (a language shift, a no-change-since-last-check, a no-match) as an event on the Live feed. Use this from the watcher loop to record what you saw. No substrate mutation.",
  input_schema: {
    type: "object",
    properties: {
      kind: {
        enum: ["language_shift", "no_change", "no_match", "anomaly", "note"],
      },
      summary: {
        type: "string",
        description: "One paragraph. Terse, specific, no filler.",
      },
      subject_kind: { type: "string" },
      subject_id: { type: "string" },
    },
    required: ["kind", "summary"],
  },
  confirm: false,
  async exec({ env, userId }, input) {
    const kind = String(input.kind);
    const summary = String(input.summary);
    const eventId = await insertOne(env.DB, "orchestrator_events", {
      user_id: userId,
      event_type: `finding.${kind}`,
      subject_kind: (input.subject_kind as string | undefined) ?? null,
      subject_id: (input.subject_id as string | undefined) ?? null,
      payload: { kind, summary },
    });
    return {
      output: `Logged ${kind}: ${summary}`,
      side_effects: [{ kind: "role_invocation", id: eventId, summary }],
    };
  },
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const TOOLS: ToolDef[] = [
  search_substrate,
  query_graph,
  read_file,
  fetch_url,
  create_source,
  run_role_tool,
  extract_entities,
  commit_entities,
  create_claim,
  create_thesis,
  seed_example_content,
  note_finding,
  ...WEB_RESEARCH_TOOLS,
  ...CHARACTER_TOOLS,
];

export const TOOLS_BY_NAME: Record<string, ToolDef> = Object.fromEntries(
  TOOLS.map((t) => [t.name, t]),
);

export function toolDefinitionsForModel() {
  return TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));
}

// satisfy unused-import warnings when callers don't pull parseJson
void parseJson;
