import { publicGet } from "@/lib/public-api";
import { notFound } from "next/navigation";

export const runtime = "edge";

interface EntityCache {
  slug: string;
  canonical_name: string;
  entity_type: string;
  summary: string | null;
  payload: {
    timeline?: Array<{ date: string; event: string }>;
    relations?: Array<{ name: string; relation_type: string }>;
    theses?: Array<{ slug: string; title: string }>;
    claims?: Array<{ slug: string; claim_text: string }>;
  };
}

export default async function EntityDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = await publicGet<{ entity: EntityCache }>(`/v1/public/entities/${slug}`, 60).catch(
    () => null,
  );
  if (!r) notFound();
  const e = r.entity;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <p className="mb-2 font-mono text-[10.5px] uppercase tracking-wider text-[var(--ink-mute)]">
        {e.entity_type}
      </p>
      <h1 className="font-serif text-4xl text-[var(--ink)]">{e.canonical_name}</h1>
      {e.summary && (
        <p className="mt-3 font-serif text-lg italic text-[var(--ink-2)]">{e.summary}</p>
      )}

      {e.payload.timeline && e.payload.timeline.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-3 font-mono text-[11px] uppercase tracking-wider text-[var(--ink-mute)]">
            Timeline
          </h2>
          <ul className="space-y-2">
            {e.payload.timeline.map((t, i) => (
              <li key={i} className="font-serif">
                <span className="font-mono text-[10.5px] text-[var(--ink-mute)]">{t.date}</span> ·{" "}
                {t.event}
              </li>
            ))}
          </ul>
        </section>
      )}

      {e.payload.relations && e.payload.relations.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-3 font-mono text-[11px] uppercase tracking-wider text-[var(--ink-mute)]">
            Relations
          </h2>
          <ul className="space-y-1 font-serif">
            {e.payload.relations.map((rel, i) => (
              <li key={i}>
                <span className="font-mono text-[10.5px] text-[var(--ink-mute)]">
                  {rel.relation_type.replace(/_/g, " ")}
                </span>{" "}
                · {rel.name}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
