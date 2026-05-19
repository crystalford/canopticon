import { publicGet } from "@/lib/public-api";

export const runtime = "edge";

interface PubContradiction {
  slug: string;
  posture: string;
  resolution_reasoning?: string | null;
  payload: { headline?: string; claim_a?: string; claim_b?: string };
  refreshed_at: string;
}

const postureLabels: Record<string, string> = {
  open: "Open",
  resolved_a: "Resolved one way",
  resolved_b: "Resolved other way",
  machloket: "Machloket — held open",
  retired: "Retired",
};

const postureColors: Record<string, string> = {
  open: "border-[var(--signal)]",
  resolved_a: "border-[var(--verified)]",
  resolved_b: "border-[var(--verified)]",
  machloket: "border-[var(--warning)]",
  retired: "border-[var(--ink-mute)]",
};

export default async function ContradictionsPage() {
  const r = await publicGet<{ contradictions: PubContradiction[] }>(
    "/v1/public/contradictions",
    60,
  ).catch(() => ({ contradictions: [] }));

  const grouped: Record<string, PubContradiction[]> = {};
  for (const c of r.contradictions) {
    (grouped[c.posture] = grouped[c.posture] ?? []).push(c);
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="mb-2 font-serif text-4xl text-[var(--ink)]">Contradictions</h1>
      <p className="mb-8 font-serif italic text-[var(--ink-3)]">
        What the graph can't reconcile, and why.
      </p>

      {Object.entries(grouped).map(([posture, items]) => (
        <section key={posture} className="mb-10">
          <h2 className="mb-3 font-mono text-[11px] uppercase tracking-wider text-[var(--ink-mute)]">
            {postureLabels[posture] ?? posture}
          </h2>
          <ul className="space-y-3">
            {items.map((c) => (
              <li
                key={c.slug}
                className={`border-l-2 ${postureColors[posture] ?? "border-[var(--ink-mute)]"} pl-4`}
              >
                {c.payload.headline && (
                  <p className="font-serif text-lg text-[var(--ink)]">{c.payload.headline}</p>
                )}
                {c.payload.claim_a && (
                  <p className="mt-1 font-serif italic text-[var(--ink-2)]">
                    "{c.payload.claim_a}"
                  </p>
                )}
                {c.payload.claim_b && (
                  <p className="mt-1 font-serif italic text-[var(--ink-2)]">
                    vs. "{c.payload.claim_b}"
                  </p>
                )}
                {c.resolution_reasoning && (
                  <p className="mt-2 font-serif text-sm text-[var(--ink-3)]">
                    {c.resolution_reasoning}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {r.contradictions.length === 0 && (
        <p className="font-serif italic text-[var(--ink-faint)]">No tracked contradictions yet.</p>
      )}
    </div>
  );
}
