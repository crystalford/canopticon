// Public character page. canopticon.com/p/characters/<slug>
//
// Renders: portrait + name + role + heat tag, bio markdown, vertical
// timeline of confirmed events, recent claims about the character, and
// the network of relations to other entities.

import { publicGet } from "@/lib/public-api";
import { notFound } from "next/navigation";
import Link from "next/link";

export const runtime = "edge";

interface Profile {
  id: string;
  entity_id: string;
  canonical_name: string;
  slug: string;
  current_role: string | null;
  bio_md: string;
  bio_html: string | null;
  wikipedia_url: string | null;
  portrait_url: string | null;
  updated_at: string;
}

interface TimelineEvent {
  event_date: string;
  event_title: string;
  event_body: string | null;
  significance: "major" | "context";
  source_claim_ids: string[];
}

interface ClaimRow {
  id: string;
  claim_text: string;
  layer: string;
  admiralty_grade: string | null;
  ipcc_likelihood: string | null;
  public_slug: string | null;
  created_at: string;
}

interface RelationRow {
  relation_type: string;
  strength: number;
  active_from: string | null;
  active_to: string | null;
  other_name: string;
  other_id: string;
  other_slug: string | null;
}

interface DetailResponse {
  profile: Profile;
  heat_score: number;
  timeline: TimelineEvent[];
  claims: ClaimRow[];
  relations: RelationRow[];
}

export default async function CharacterPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const r = await publicGet<DetailResponse>(`/v1/public/characters/${slug}`, 60).catch(
    () => null,
  );
  if (!r) notFound();
  const { profile, heat_score, timeline, claims, relations } = r;

  return (
    <article className="mx-auto max-w-3xl px-6 py-12">
      <p className="mb-2 font-mono text-[10.5px] uppercase tracking-wider text-[var(--ink-mute)]">
        CANOPTICON · DOSSIER · {watchTagForHeat(heat_score).toUpperCase()}
      </p>
      <div className="flex items-start gap-5">
        {profile.portrait_url ? (
          // biome-ignore lint/performance/noImgElement: external Wikipedia URLs
          <img
            src={profile.portrait_url}
            alt=""
            width={96}
            height={96}
            className="h-24 w-24 rounded-full object-cover"
          />
        ) : null}
        <div className="flex-1">
          <h1 className="font-serif text-5xl leading-tight text-[var(--ink)]">
            {profile.canonical_name}
          </h1>
          {profile.current_role && (
            <p className="mt-3 font-serif text-xl italic text-[var(--ink-3)]">
              {profile.current_role}
            </p>
          )}
        </div>
      </div>

      <section className="mt-10 font-serif text-lg leading-relaxed text-[var(--ink)]">
        <BioBody markdown={profile.bio_md} />
      </section>

      {timeline.length > 0 && (
        <section className="mt-16">
          <h2 className="font-serif text-3xl text-[var(--ink)]">Timeline</h2>
          <ol className="mt-6 flex flex-col gap-6">
            {timeline.map((t, i) => (
              <li
                key={`${t.event_date}-${i}`}
                className="grid grid-cols-[100px_1fr] gap-4"
              >
                <span className="font-mono text-[12px] text-[var(--ink-mute)]">
                  {t.event_date}
                </span>
                <div>
                  {t.significance === "major" && (
                    <span className="mr-2 inline-block rounded-sm bg-[var(--signal)]/10 px-1 font-mono text-[10px] uppercase tracking-wider text-[var(--signal)]">
                      major
                    </span>
                  )}
                  <span className="font-serif text-lg text-[var(--ink)]">
                    {t.event_title}
                  </span>
                  {t.event_body && t.event_body !== t.event_title && (
                    <p className="mt-1 text-sm text-[var(--ink-3)]">{t.event_body}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {claims.length > 0 && (
        <section className="mt-16">
          <h2 className="font-serif text-3xl text-[var(--ink)]">Recorded claims</h2>
          <ul className="mt-6 flex flex-col gap-3">
            {claims.map((c) => (
              <li
                key={c.id}
                className="rounded-md border border-[var(--rule)] p-3 text-sm"
              >
                <div className="mb-1 font-mono text-[10.5px] uppercase tracking-wider text-[var(--ink-mute)]">
                  {c.layer}
                  {c.admiralty_grade ? ` · ${c.admiralty_grade}` : ""}
                  {c.ipcc_likelihood ? ` · ${c.ipcc_likelihood}` : ""}
                </div>
                {c.public_slug ? (
                  <Link
                    href={`/claims/${c.public_slug}`}
                    className="text-[var(--ink)] hover:text-[var(--signal)]"
                  >
                    {c.claim_text}
                  </Link>
                ) : (
                  <span className="text-[var(--ink)]">{c.claim_text}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {relations.length > 0 && (
        <section className="mt-16">
          <h2 className="font-serif text-3xl text-[var(--ink)]">Network</h2>
          <ul className="mt-6 flex flex-col gap-2">
            {relations.map((r, i) => (
              <li key={`${r.other_id}-${i}`} className="text-sm text-[var(--ink-2)]">
                <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--ink-mute)]">
                  {r.relation_type}
                </span>{" "}
                ·{" "}
                {r.other_slug ? (
                  <Link
                    href={`/entities/${r.other_slug}`}
                    className="text-[var(--ink)] hover:text-[var(--signal)]"
                  >
                    {r.other_name}
                  </Link>
                ) : (
                  r.other_name
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {profile.wikipedia_url && (
        <p className="mt-12 border-t border-[var(--rule)] pt-6 font-mono text-[10.5px] uppercase tracking-wider text-[var(--ink-mute)]">
          Seed source:{" "}
          <a
            href={profile.wikipedia_url}
            target="_blank"
            rel="noreferrer"
            className="text-[var(--ink-3)] underline"
          >
            Wikipedia
          </a>
        </p>
      )}
    </article>
  );
}

function watchTagForHeat(score: number): string {
  if (score >= 0.85) return "Primary";
  if (score >= 0.65) return "Watch";
  return "Adjacent";
}

// Minimal markdown→HTML rendering for the bio body. We avoid pulling a
// full markdown library on the public site to keep the bundle small;
// the bio body is operator-curated so the supported subset is tight.
function BioBody({ markdown }: { markdown: string }) {
  const lines = markdown.split("\n");
  const blocks: Array<{ type: "h1" | "h2" | "h3" | "p" | "blank"; text: string }> = [];
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      blocks.push({ type: "blank", text: "" });
      continue;
    }
    if (line.startsWith("# ")) blocks.push({ type: "h1", text: line.slice(2) });
    else if (line.startsWith("## ")) blocks.push({ type: "h2", text: line.slice(3) });
    else if (line.startsWith("### ")) blocks.push({ type: "h3", text: line.slice(4) });
    else blocks.push({ type: "p", text: line });
  }
  // Drop leading H1 (already shown as page title).
  while (blocks.length > 0) {
    const head = blocks[0];
    if (!head || head.type === "p" || head.type === "blank") break;
    if (head.type === "h1") {
      blocks.shift();
    } else {
      break;
    }
  }
  return (
    <>
      {blocks.map((b, i) => {
        if (b.type === "blank") return null;
        if (b.type === "h2")
          return (
            <h2
              key={i}
              className="mt-8 font-serif text-3xl text-[var(--ink)]"
            >
              {b.text}
            </h2>
          );
        if (b.type === "h3")
          return (
            <h3
              key={i}
              className="mt-6 font-serif text-2xl text-[var(--ink)]"
            >
              {b.text}
            </h3>
          );
        return (
          <p key={i} className="my-4">
            {b.text}
          </p>
        );
      })}
    </>
  );
}
