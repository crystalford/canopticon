// Seed-example-content tool body. Three short public-domain excerpts that
// give the operator something to look at on first login.

import type { Env } from "../../env";
import { insertOne } from "../../lib/d1";
import { embedText, upsertVector, vectorId } from "./embeddings";

interface SeedSource {
  title: string;
  source_type: "news" | "filing" | "operator_note";
  content_text: string;
  authors: string[];
  published_at: string;
  url?: string;
}

const SEED_SOURCES: SeedSource[] = [
  {
    title: "Federal budget tabling — fiscal outlook briefing",
    source_type: "filing",
    authors: ["Department of Finance"],
    published_at: "2026-04-15",
    content_text:
      "The federal government tabled the 2026 budget on April 15. Headline deficit revised upward to $48.3B from the November Fall Economic Statement projection of $39.8B, citing weaker corporate income tax receipts and higher debt-service costs. Net debt to GDP ratio is projected to peak at 43.1% in 2027-28 before declining. Three new measures: (1) doubling the GST rental rebate for purpose-built rental construction through 2030; (2) a Canadian Strategic Reserve Fund seeded at $4B with mandate to backstop critical-minerals processing capacity; (3) a temporary 2% corporate surtax on banks and insurers with profits above $1B, sunsetting in 2029. The Parliamentary Budget Officer flagged the surtax revenue projections as 'optimistic given likely litigation timing'.",
  },
  {
    title: "Critical minerals supply chain — analyst note",
    source_type: "news",
    authors: ["Capital Economics Research Desk"],
    published_at: "2026-04-22",
    content_text:
      "Following last week's budget, three Canadian rare-earths developers — Vital Metals, Ucore Rare Metals, and Search Minerals — saw share prices rise 12% on average. The Strategic Reserve Fund's structure remains ambiguous: officials describe it as 'patient equity' but have not specified whether it will take board seats or merely provide loan guarantees. Industry observers note that without offtake commitments from Canadian or allied processors, the fund risks subsidizing extraction whose output still flows to Chinese refining capacity. The previous Conservative government's 2023 'Canada First' minerals strategy faced the same criticism and was wound down in 2024 after producing only two completed transactions.",
  },
  {
    title: "Statement from the Minister of Finance to the House",
    source_type: "operator_note",
    authors: ["Hon. Minister of Finance"],
    published_at: "2026-04-15",
    content_text:
      "Madam Speaker, this budget is about building. It is about building homes — and our doubled rental rebate will see 180,000 new purpose-built rental units broken ground on by 2030. It is about building Canadian industrial capacity — and the Strategic Reserve Fund will ensure that when the world needs Canadian critical minerals, the value-add stays here. And yes, it asks the largest financial institutions — those that have done very well in this economy — to contribute a temporary surtax that will fund these investments. The honourable member opposite will no doubt say this is fiscally irresponsible. I say: failing to invest in Canadian sovereignty is what is irresponsible.",
  },
];

export interface SeedResult {
  sources: Array<{ id: string; title: string }>;
}

export async function seedExamples(env: Env, userId: string): Promise<SeedResult> {
  const created: Array<{ id: string; title: string }> = [];
  for (const s of SEED_SOURCES) {
    const id = await insertOne(env.DB, "sources", {
      user_id: userId,
      source_type: s.source_type,
      ingestion_state: "pending_critic",
      title: s.title,
      content_text: s.content_text,
      authors: s.authors,
      published_at: s.published_at,
      url: s.url ?? null,
      ingested_via: "seed_example_content",
    });
    created.push({ id, title: s.title });
    try {
      const values = await embedText(env, `${s.title}\n${s.content_text}`);
      await upsertVector(env, {
        id: vectorId("source", id),
        values,
        metadata: { user_id: userId, kind: "source", id, title: s.title },
      });
    } catch {
      // non-fatal
    }
  }
  return { sources: created };
}
