"use client";

import { Badge, Card, ScreenHeader, StatList } from "@/components/primitives";
import { ApiError, apiGet } from "@/lib/api-client";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";

interface EntityDetail {
  id: string;
  entity_type: string;
  canonical_name: string;
  display_name: string;
  aliases: string[];
  slug: string | null;
  description: string | null;
  metadata: Record<string, unknown>;
  first_seen_at: string;
  last_seen_at: string;
  mention_count: number;
  claim_count: number;
}

export default function EntityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [entity, setEntity] = useState<EntityDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    apiGet<EntityDetail>(`/v1/entities/${id}`)
      .then(setEntity)
      .catch((err) => setError(err instanceof ApiError ? err.message : (err as Error).message));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <div className="px-6 py-8 max-w-3xl mx-auto">
        <BackLink />
        <p className="text-signal font-mono text-xs mt-6">could not load: {error}</p>
      </div>
    );
  }
  if (!entity) {
    return (
      <div className="px-6 py-8 max-w-3xl mx-auto">
        <p className="text-text-faint font-mono text-xs uppercase tracking-widest">loading...</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto">
      <BackLink />

      <ScreenHeader
        title={entity.canonical_name}
        subtitle={
          <>
            {entity.entity_type}
            {entity.slug ? ` · ${entity.slug}` : ""} · first seen{" "}
            {new Date(entity.first_seen_at).toLocaleDateString()} · last seen{" "}
            {new Date(entity.last_seen_at).toLocaleDateString()}
          </>
        }
      />

      <Card className="mb-6">
        <StatList
          stats={[
            { label: "type", value: entity.entity_type },
            { label: "mentions", value: String(entity.mention_count) },
            { label: "claims", value: String(entity.claim_count) },
            { label: "aliases", value: String(entity.aliases.length) },
          ]}
        />
      </Card>

      {entity.description && (
        <section className="mb-6">
          <h2 className="font-mono text-xs uppercase tracking-widest text-text-dim mb-2">
            description
          </h2>
          <p className="text-text leading-relaxed">{entity.description}</p>
        </section>
      )}

      {entity.aliases.length > 0 && (
        <section className="mb-6">
          <h2 className="font-mono text-xs uppercase tracking-widest text-text-dim mb-2">
            aliases
          </h2>
          <div className="flex gap-2 flex-wrap">
            {entity.aliases.map((alias) => (
              <Badge key={alias} tone="neutral">
                {alias}
              </Badge>
            ))}
          </div>
        </section>
      )}

      {entity.metadata && Object.keys(entity.metadata).length > 0 && (
        <section className="mb-6">
          <h2 className="font-mono text-xs uppercase tracking-widest text-text-dim mb-2">
            metadata
          </h2>
          <pre className="text-text-dim text-sm font-mono leading-relaxed bg-bg-elevated border border-border-soft p-3 overflow-x-auto">
            {JSON.stringify(entity.metadata, null, 2)}
          </pre>
        </section>
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href={"/entities" as never}
      className="text-text-dim hover:text-amber font-mono text-xs uppercase tracking-widest"
    >
      ← all entities
    </Link>
  );
}
