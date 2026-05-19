"use client";

// Characters admin — lists every promoted character with a heat score
// and pending-proposal count. Click into a character to read the bio,
// review proposed updates, and edit the canonical timeline.

import { apiGet } from "@/lib/api-client";
import Link from "next/link";
import { useEffect, useState } from "react";

interface CharacterRow {
  profile_id: string;
  entity_id: string;
  canonical_name: string;
  slug: string;
  current_role: string | null;
  portrait_url: string | null;
  heat_score: number;
  mention_count: number;
  pending_proposals: number;
}

export default function CharactersPage() {
  const [characters, setCharacters] = useState<CharacterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending">("all");

  useEffect(() => {
    void (async () => {
      try {
        const r = await apiGet<{ characters: CharacterRow[] }>("/v1/characters/");
        setCharacters(r.characters);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const visible =
    filter === "pending" ? characters.filter((c) => c.pending_proposals > 0) : characters;

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 20 }}>
        <div className="row" style={{ gap: 6 }}>
          <button
            type="button"
            className={`btn sm ${filter === "all" ? "primary" : ""}`}
            onClick={() => setFilter("all")}
          >
            All
          </button>
          <button
            type="button"
            className={`btn sm ${filter === "pending" ? "primary" : ""}`}
            onClick={() => setFilter("pending")}
          >
            Pending review
          </button>
        </div>
        <Link href="/chat" className="btn sm signal-primary">
          + Promote via chat →
        </Link>
      </div>

      {loading && (
        <div
          className="card flat"
          style={{ textAlign: "center", padding: 32, color: "var(--ink-mute)" }}
        >
          Loading…
        </div>
      )}

      {!loading && visible.length === 0 && (
        <div
          className="card flat"
          style={{ textAlign: "center", padding: "48px 24px", color: "var(--ink-mute)" }}
        >
          <p style={{ marginBottom: 8 }}>
            {filter === "pending" ? "No pending proposals." : "No characters yet."}
          </p>
          <p style={{ fontSize: 13 }}>
            Characters auto-promote when a person's heat score crosses 0.6, or you can promote
            manually from chat: "seed character from wikipedia: Mark Carney".
          </p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {visible.map((c) => (
          <article key={c.profile_id} className="card compact">
            <div className="row" style={{ alignItems: "flex-start", gap: 16 }}>
              {c.portrait_url ? (
                <img
                  src={c.portrait_url}
                  alt=""
                  width={56}
                  height={56}
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 999,
                    objectFit: "cover",
                    flexShrink: 0,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 999,
                    background: "var(--panel-2)",
                    flexShrink: 0,
                  }}
                />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row" style={{ gap: 8, marginBottom: 6 }}>
                  <span className="chip mono">heat {c.heat_score.toFixed(2)}</span>
                  <span className="chip chip-mute">{c.mention_count} mentions</span>
                  {c.pending_proposals > 0 && (
                    <span className="chip chip-signal">{c.pending_proposals} pending</span>
                  )}
                </div>
                <h3
                  style={{
                    fontSize: 18,
                    fontWeight: 600,
                    letterSpacing: "-0.015em",
                    color: "var(--ink)",
                  }}
                >
                  {c.canonical_name}
                </h3>
                {c.current_role && (
                  <p style={{ marginTop: 4, fontSize: 14, color: "var(--ink-3)" }}>
                    {c.current_role}
                  </p>
                )}
                <p
                  className="mono"
                  style={{ marginTop: 6, fontSize: 11, color: "var(--ink-mute)" }}
                >
                  /p/characters/{c.slug}
                </p>
              </div>
              <Link href={`/characters/${c.slug}`} className="btn sm ghost">
                Open
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
