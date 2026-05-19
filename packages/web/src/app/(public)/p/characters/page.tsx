// Public index of character profiles. canopticon.com/p/characters

import { publicGet } from "@/lib/public-api";
import Link from "next/link";

export const runtime = "edge";

interface CharacterRow {
  slug: string;
  canonical_name: string;
  current_role: string | null;
  portrait_url: string | null;
  heat_score: number;
  updated_at: string;
}

export default async function PublicCharactersIndex() {
  const r = await publicGet<{ characters: CharacterRow[] }>(
    "/v1/public/characters?limit=120",
    120,
  ).catch(() => ({ characters: [] }));
  const characters = r.characters;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="mb-2 font-mono text-[10.5px] uppercase tracking-wider text-[var(--ink-mute)]">
        CANOPTICON · DOSSIERS
      </p>
      <h1 className="font-serif text-5xl leading-tight text-[var(--ink)]">Characters</h1>
      <p className="mt-3 font-serif text-xl italic text-[var(--ink-3)]">
        Public figures we track — bios, timelines, and every claim we&apos;ve recorded.
      </p>

      {characters.length === 0 ? (
        <p className="mt-12 text-[var(--ink-mute)]">No characters yet.</p>
      ) : (
        <ul className="mt-12 flex flex-col gap-6">
          {characters.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/p/characters/${c.slug}`}
                className="flex items-start gap-4 rounded-md border border-[var(--rule)] p-4 transition hover:border-[var(--signal)]"
              >
                {c.portrait_url ? (
                  // biome-ignore lint/performance/noImgElement: external Wikipedia URLs
                  <img
                    src={c.portrait_url}
                    alt=""
                    width={56}
                    height={56}
                    className="h-14 w-14 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-14 w-14 rounded-full bg-[var(--paper-2)]" />
                )}
                <div className="flex-1">
                  <div className="font-serif text-xl text-[var(--ink)]">{c.canonical_name}</div>
                  {c.current_role && (
                    <div className="text-sm text-[var(--ink-3)]">{c.current_role}</div>
                  )}
                  <div className="mt-1 font-mono text-[10.5px] uppercase tracking-wider text-[var(--ink-mute)]">
                    heat {c.heat_score.toFixed(2)} ·{" "}
                    {watchTagForHeat(c.heat_score)}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function watchTagForHeat(score: number): string {
  if (score >= 0.85) return "Primary";
  if (score >= 0.65) return "Watch";
  return "Adjacent";
}
