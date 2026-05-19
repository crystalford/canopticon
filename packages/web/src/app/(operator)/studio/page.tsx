"use client";

// Studio compartment — audio production. Six tabs cover the lifecycle:
// proposed (Llama drafted, awaiting approval) → approved → recording →
// paused → rendered → archived. Studio is gated on STUDIO_ENABLED; the
// API 404s every route when the flag is off, in which case we show the
// placeholder copy below.

import { apiGet, apiPost } from "@/lib/api-client";
import Link from "next/link";
import { useEffect, useState } from "react";

interface Production {
  id: string;
  title: string;
  state:
    | "script_proposed"
    | "script_approved"
    | "recording"
    | "paused"
    | "stitching"
    | "rendered"
    | "archived";
  source_kind: string;
  script_total_seconds: number | null;
  use_anthropic: number;
  rendered_audio_uri: string | null;
  updated_at: string;
}

type Tab = "proposed" | "approved" | "recording" | "paused" | "rendered" | "archived";

const TAB_STATE: Record<Tab, Production["state"]> = {
  proposed: "script_proposed",
  approved: "script_approved",
  recording: "recording",
  paused: "paused",
  rendered: "rendered",
  archived: "archived",
};

export default function StudioPage() {
  const [tab, setTab] = useState<Tab>("proposed");
  const [productions, setProductions] = useState<Production[]>([]);
  const [disabled, setDisabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const state = TAB_STATE[tab];
      const r = await apiGet<{ productions: Production[] }>(
        `/v1/studio/productions?state=${state}`,
      );
      setProductions(r.productions);
      setDisabled(false);
    } catch (err) {
      const e = err as { status?: number };
      if (e.status === 404) setDisabled(true);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [tab]);

  async function action(
    id: string,
    kind: "approve" | "start" | "pause" | "resume" | "stitch" | "archive",
  ) {
    setBusy(true);
    try {
      const path =
        kind === "approve"
          ? `/v1/studio/productions/${id}/approve`
          : kind === "start"
            ? `/v1/studio/productions/${id}/start-recording`
            : kind === "pause"
              ? `/v1/studio/productions/${id}/pause`
              : kind === "resume"
                ? `/v1/studio/productions/${id}/resume`
                : kind === "stitch"
                  ? `/v1/studio/productions/${id}/stitch`
                  : `/v1/studio/productions/${id}/archive`;
      await apiPost(path);
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (disabled) {
    return (
      <div className="card flat" style={{ padding: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Studio</h1>
        <p style={{ color: "var(--ink-3)", marginBottom: 4 }}>
          Studio is disabled in this environment.
        </p>
        <p style={{ fontSize: 13, color: "var(--ink-mute)" }}>
          Set <code>STUDIO_ENABLED=&quot;true&quot;</code> in <code>wrangler.toml</code> to enable
          audio production (script ideator, recording overlay, stitch workflow).
        </p>
      </div>
    );
  }

  const TABS: Array<{ key: Tab; label: string }> = [
    { key: "proposed", label: "Proposed" },
    { key: "approved", label: "Ready" },
    { key: "recording", label: "Recording" },
    { key: "paused", label: "Paused" },
    { key: "rendered", label: "Rendered" },
    { key: "archived", label: "Archive" },
  ];

  return (
    <div>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em" }}>Studio</h1>
        <p style={{ color: "var(--ink-3)", fontSize: 14 }}>
          Audio production. From post or claims → script → recording → stitch.
        </p>
      </header>

      <div className="row" style={{ gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`btn sm ${tab === t.key ? "primary" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div
          className="card flat"
          style={{ textAlign: "center", padding: 32, color: "var(--ink-mute)" }}
        >
          Loading…
        </div>
      )}

      {!loading && productions.length === 0 && (
        <div
          className="card flat"
          style={{ textAlign: "center", padding: "48px 24px", color: "var(--ink-mute)" }}
        >
          <p style={{ marginBottom: 8 }}>Nothing here.</p>
          <p style={{ fontSize: 13 }}>
            Start in chat: &quot;make a script from my post on X&quot;.
          </p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {productions.map((p) => (
          <article key={p.id} className="card compact">
            <div
              className="row"
              style={{ justifyContent: "space-between", alignItems: "flex-start" }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row" style={{ gap: 8, marginBottom: 6 }}>
                  <span className="chip">{p.source_kind}</span>
                  <span className="chip chip-mute mono">{p.state}</span>
                  {p.script_total_seconds && (
                    <span className="chip chip-mute mono">
                      ~{Math.round(p.script_total_seconds / 60)} min
                    </span>
                  )}
                  {p.use_anthropic === 1 && <span className="chip chip-signal">claude</span>}
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>{p.title}</h3>
                <p
                  className="mono"
                  style={{ marginTop: 6, fontSize: 11, color: "var(--ink-mute)" }}
                >
                  Updated {new Date(p.updated_at).toLocaleString()}
                </p>
              </div>
              <div className="row" style={{ gap: 6 }}>
                {tab === "proposed" && (
                  <button
                    type="button"
                    className="btn sm primary"
                    onClick={() => void action(p.id, "approve")}
                    disabled={busy}
                  >
                    Approve
                  </button>
                )}
                {(tab === "approved" || tab === "paused") && (
                  <Link href={`/studio/record/${p.id}`} className="btn sm primary">
                    {tab === "paused" ? "Resume" : "Record"}
                  </Link>
                )}
                {tab === "recording" && (
                  <>
                    <Link href={`/studio/record/${p.id}`} className="btn sm primary">
                      Open
                    </Link>
                    <button
                      type="button"
                      className="btn sm ghost"
                      onClick={() => void action(p.id, "pause")}
                      disabled={busy}
                    >
                      Pause
                    </button>
                  </>
                )}
                {(tab === "approved" || tab === "recording" || tab === "paused") && (
                  <button
                    type="button"
                    className="btn sm ghost"
                    onClick={() => void action(p.id, "stitch")}
                    disabled={busy}
                  >
                    Stitch
                  </button>
                )}
                {tab === "rendered" && p.rendered_audio_uri && (
                  <a
                    href={`/api/v1/studio/productions/${p.id}/bundle`}
                    className="btn sm primary"
                    download
                  >
                    Download
                  </a>
                )}
                {tab !== "archived" && (
                  <button
                    type="button"
                    className="btn sm ghost"
                    onClick={() => void action(p.id, "archive")}
                    disabled={busy}
                  >
                    Archive
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
