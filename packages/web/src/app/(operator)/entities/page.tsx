"use client";

import { Badge, Button, Card, ScreenHeader } from "@/components/primitives";
import { ApiError, apiGet, apiPost } from "@/lib/api-client";
import { useCallback, useEffect, useState } from "react";

interface EntityRow {
  id: string;
  entity_type: string;
  canonical_name: string;
  display_name: string;
  aliases: string[];
  slug: string | null;
  last_seen_at: string;
}

interface MentionRow {
  id: string;
  source_id: string;
  mention_text: string;
  context_excerpt: string | null;
  created_at: string;
}

interface ResolveResult {
  status: string;
  mentions_considered: number;
  mentions_resolved_exact: number;
  mentions_resolved_high: number;
  mentions_ambiguous: number;
  mentions_no_match: number;
  claim_entities_written: number;
}

export default function EntitiesPage() {
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [mentions, setMentions] = useState<MentionRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [lastResult, setLastResult] = useState<ResolveResult | null>(null);
  const [linkPick, setLinkPick] = useState<Record<string, string>>({});
  const [linking, setLinking] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([
      apiGet<EntityRow[]>("/v1/entities"),
      apiGet<MentionRow[]>("/v1/entities/mentions/unresolved"),
    ])
      .then(([e, m]) => {
        setEntities(e);
        setMentions(m);
      })
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : (err as Error).message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function resolve() {
    setResolving(true);
    setLastResult(null);
    try {
      const result = await apiPost<ResolveResult>("/v1/entities/resolve", {});
      setLastResult(result);
      load();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setResolving(false);
    }
  }

  async function linkOne(mentionId: string) {
    const entityId = linkPick[mentionId];
    if (!entityId) return;
    setLinking(mentionId);
    try {
      await apiPost(`/v1/entities/mentions/${mentionId}/link`, { entity_id: entityId });
      load();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setLinking(null);
    }
  }

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto">
      <ScreenHeader
        title="Entities"
        subtitle="canonical actors · resolved mentions · review queue"
        actions={
          <Button tone="primary" size="sm" onClick={resolve} disabled={resolving}>
            {resolving ? "resolving..." : "run resolver"}
          </Button>
        }
      />

      {lastResult && (
        <Card tone="amber" className="mb-6">
          <p className="font-mono text-xs uppercase tracking-widest text-amber mb-2">
            last resolver run
          </p>
          <p className="text-text font-mono text-xs leading-relaxed">
            considered {lastResult.mentions_considered} · exact {lastResult.mentions_resolved_exact}{" "}
            · high {lastResult.mentions_resolved_high} · ambiguous {lastResult.mentions_ambiguous} ·
            no match {lastResult.mentions_no_match} · claim_entities written{" "}
            {lastResult.claim_entities_written}
          </p>
        </Card>
      )}

      {loadError && (
        <p className="text-signal font-mono text-xs mb-4">could not load: {loadError}</p>
      )}

      <section className="mb-10">
        <h2 className="font-serif text-xl text-cream mb-3">
          Review queue ({mentions.length} unresolved)
        </h2>
        {mentions.length === 0 ? (
          <p className="text-text-faint font-mono text-xs uppercase tracking-widest">
            no unresolved mentions
          </p>
        ) : (
          <ul className="space-y-3">
            {mentions.map((m) => (
              <li key={m.id} className="border-l-2 border-amber-dim pl-3 py-1">
                <p className="text-cream font-serif">{m.mention_text}</p>
                {m.context_excerpt && (
                  <p className="text-text-dim text-sm mt-1 leading-relaxed">{m.context_excerpt}</p>
                )}
                <div className="flex items-baseline gap-2 mt-2">
                  <select
                    value={linkPick[m.id] ?? ""}
                    onChange={(e) => setLinkPick((prev) => ({ ...prev, [m.id]: e.target.value }))}
                    className="block bg-bg-elevated border border-border-bright text-text px-3 py-1 font-mono text-xs focus:border-amber focus:outline-none"
                  >
                    <option value="">— pick entity —</option>
                    {entities.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.canonical_name} ({e.entity_type})
                      </option>
                    ))}
                  </select>
                  <Button
                    tone="secondary"
                    size="sm"
                    onClick={() => linkOne(m.id)}
                    disabled={linking === m.id || !linkPick[m.id]}
                  >
                    {linking === m.id ? "..." : "link"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-serif text-xl text-cream mb-3">
          Canonical entities ({entities.length})
        </h2>
        {entities.length === 0 ? (
          <p className="text-text-faint font-mono text-xs uppercase tracking-widest">
            no entities declared yet
          </p>
        ) : (
          <ol className="divide-y divide-border-soft">
            {entities.map((e) => (
              <li key={e.id} className="py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-cream font-serif">{e.canonical_name}</p>
                  <Badge tone="neutral">{e.entity_type}</Badge>
                </div>
                {e.aliases.length > 0 && (
                  <p className="text-text-faint font-mono text-xs mt-1">
                    aka {e.aliases.join(" · ")}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
