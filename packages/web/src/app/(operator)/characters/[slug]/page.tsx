"use client";

// Character detail — bio editor, timeline (proposed + confirmed), and
// proposal review queue. The bio is markdown-editable; everything else
// is approve/reject buttons on the proposals.

import { apiGet, apiPatch, apiPost } from "@/lib/api-client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

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
  last_synced_at: string | null;
  version_count: number;
  visibility: string;
  updated_at: string;
}

interface TimelineEvent {
  id: string;
  event_date: string;
  event_title: string;
  event_body: string | null;
  significance: "major" | "context";
  status: "proposed" | "confirmed" | "rejected";
  proposed_by: string;
  source_claim_ids: string[];
}

interface Proposal {
  id: string;
  kind: "timeline_event" | "bio_revision" | "role_change";
  proposed_payload: Record<string, unknown>;
  rationale: string | null;
  source_claim_ids: string[];
  created_at: string;
}

interface DetailResponse {
  profile: Profile;
  heat_score: number;
  heat_breakdown: Record<string, unknown> | null;
  timeline: TimelineEvent[];
  proposals: Proposal[];
}

export default function CharacterDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? "";
  const [data, setData] = useState<DetailResponse | null>(null);
  const [bioDraft, setBioDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await apiGet<DetailResponse>(`/v1/characters/${slug}`);
    setData(r);
    setBioDraft(r.profile.bio_md);
  }
  useEffect(() => {
    if (slug) void load();
  }, [slug]);

  if (!data) {
    return (
      <div className="card flat" style={{ padding: 32, color: "var(--ink-mute)" }}>
        Loading…
      </div>
    );
  }
  const { profile, heat_score, timeline, proposals } = data;

  async function saveBio() {
    setBusy(true);
    try {
      await apiPatch(`/v1/characters/${slug}/bio`, { bio_md: bioDraft });
      setEditing(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function decide(id: string, decision: "approve" | "reject") {
    setBusy(true);
    try {
      await apiPost(`/v1/characters/proposals/${id}/decide`, { decision });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function reseed() {
    setBusy(true);
    try {
      await apiPost(`/v1/characters/seed`, { entity_id: profile.entity_id });
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <header className="row" style={{ gap: 16, alignItems: "flex-start" }}>
        {profile.portrait_url ? (
          // biome-ignore lint/performance/noImgElement: external Wikipedia URLs
          <img
            src={profile.portrait_url}
            alt=""
            width={88}
            height={88}
            style={{ width: 88, height: 88, borderRadius: 999, objectFit: "cover" }}
          />
        ) : null}
        <div style={{ flex: 1 }}>
          <div className="row" style={{ gap: 8, marginBottom: 6 }}>
            <span className="chip mono">heat {heat_score.toFixed(2)}</span>
            <span className="chip chip-mute">{proposals.length} pending</span>
            <span className="chip chip-mute">v{profile.version_count}</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em" }}>
            {profile.canonical_name}
          </h1>
          {profile.current_role && (
            <p style={{ marginTop: 4, color: "var(--ink-3)" }}>{profile.current_role}</p>
          )}
          <p className="mono" style={{ marginTop: 8, fontSize: 11, color: "var(--ink-mute)" }}>
            <Link
              href={`/p/characters/${profile.slug}`}
              style={{ color: "var(--ink-3)", textDecoration: "underline dotted" }}
            >
              View public page →
            </Link>
          </p>
        </div>
        <div className="row" style={{ gap: 6 }}>
          {profile.wikipedia_url && (
            <button
              type="button"
              className="btn sm ghost"
              onClick={() => void reseed()}
              disabled={busy}
            >
              Re-seed from Wikipedia
            </button>
          )}
        </div>
      </header>

      <section className="card">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Bio</h2>
          {!editing ? (
            <button
              type="button"
              className="btn sm ghost"
              onClick={() => setEditing(true)}
            >
              Edit
            </button>
          ) : (
            <div className="row" style={{ gap: 6 }}>
              <button
                type="button"
                className="btn sm ghost"
                onClick={() => {
                  setBioDraft(profile.bio_md);
                  setEditing(false);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn sm primary"
                onClick={() => void saveBio()}
                disabled={busy}
              >
                Save
              </button>
            </div>
          )}
        </div>
        {editing ? (
          <textarea
            value={bioDraft}
            onChange={(e) => setBioDraft(e.target.value)}
            rows={18}
            style={{
              width: "100%",
              fontFamily: "var(--mono)",
              fontSize: 13,
              background: "var(--panel-2)",
              border: "1px solid var(--rule)",
              borderRadius: 6,
              padding: 12,
              color: "var(--ink)",
            }}
          />
        ) : (
          <pre
            style={{
              whiteSpace: "pre-wrap",
              fontFamily: "var(--sans)",
              fontSize: 14,
              lineHeight: 1.6,
              color: "var(--ink-2)",
            }}
          >
            {profile.bio_md}
          </pre>
        )}
      </section>

      {proposals.length > 0 && (
        <section className="card">
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
            Pending proposals ({proposals.length})
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {proposals.map((p) => (
              <div
                key={p.id}
                style={{
                  border: "1px solid var(--rule)",
                  borderRadius: 6,
                  padding: 12,
                }}
              >
                <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
                  <div className="row" style={{ gap: 6 }}>
                    <span className="chip">{p.kind.replace("_", " ")}</span>
                    {p.source_claim_ids.length > 0 && (
                      <span className="chip chip-mute mono">
                        {p.source_claim_ids.length} claims
                      </span>
                    )}
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    <button
                      type="button"
                      className="btn sm ghost"
                      onClick={() => void decide(p.id, "reject")}
                      disabled={busy}
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      className="btn sm primary"
                      onClick={() => void decide(p.id, "approve")}
                      disabled={busy}
                    >
                      Approve
                    </button>
                  </div>
                </div>
                <ProposalPayload kind={p.kind} payload={p.proposed_payload} />
                {p.rationale && (
                  <p
                    style={{
                      marginTop: 8,
                      fontSize: 13,
                      color: "var(--ink-3)",
                      fontStyle: "italic",
                    }}
                  >
                    {p.rationale}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card">
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
          Timeline ({timeline.length})
        </h2>
        {timeline.length === 0 ? (
          <p style={{ color: "var(--ink-mute)", fontSize: 13 }}>No timeline events yet.</p>
        ) : (
          <ol style={{ display: "flex", flexDirection: "column", gap: 12, paddingLeft: 0 }}>
            {timeline.map((t) => (
              <li
                key={t.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "100px 1fr",
                  gap: 12,
                  listStyle: "none",
                }}
              >
                <span
                  className="mono"
                  style={{ fontSize: 12, color: "var(--ink-mute)" }}
                >
                  {t.event_date}
                </span>
                <div>
                  <div className="row" style={{ gap: 6, marginBottom: 4 }}>
                    {t.significance === "major" && (
                      <span className="chip chip-signal">major</span>
                    )}
                    <span className="chip chip-mute mono">{t.proposed_by}</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{t.event_title}</div>
                  {t.event_body && (
                    <p style={{ marginTop: 4, fontSize: 13, color: "var(--ink-3)" }}>
                      {t.event_body}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function ProposalPayload({
  kind,
  payload,
}: {
  kind: string;
  payload: Record<string, unknown>;
}) {
  if (kind === "timeline_event") {
    return (
      <div>
        <div className="mono" style={{ fontSize: 12, color: "var(--ink-mute)" }}>
          {String(payload.event_date ?? "")} ·{" "}
          {String(payload.significance ?? "context")}
        </div>
        <div style={{ marginTop: 4, fontWeight: 500 }}>
          {String(payload.event_title ?? "")}
        </div>
        {payload.event_body ? (
          <p style={{ marginTop: 4, fontSize: 13, color: "var(--ink-2)" }}>
            {String(payload.event_body)}
          </p>
        ) : null}
      </div>
    );
  }
  if (kind === "role_change") {
    return (
      <div>
        <span style={{ color: "var(--ink-3)" }}>{String(payload.from_role ?? "(unknown)")}</span>{" "}
        →{" "}
        <span style={{ fontWeight: 500 }}>{String(payload.to_role ?? "")}</span>
        {payload.effective_date ? (
          <span
            className="mono"
            style={{ marginLeft: 8, fontSize: 12, color: "var(--ink-mute)" }}
          >
            {String(payload.effective_date)}
          </span>
        ) : null}
      </div>
    );
  }
  return (
    <pre
      style={{
        whiteSpace: "pre-wrap",
        fontSize: 13,
        color: "var(--ink-2)",
        margin: 0,
      }}
    >
      {String(payload.paragraph_md ?? "")}
    </pre>
  );
}
