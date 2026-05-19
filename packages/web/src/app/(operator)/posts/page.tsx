"use client";

// Posts admin — lists drafts and published posts from the new CMS.
// The actual editor lives in chat ("draft a post about X", "publish as
// <slug>"). This page is the inventory + quick actions: read, withdraw,
// republish, dry-run publish-prep.

import { apiGet, apiPost } from "@/lib/api-client";
import Link from "next/link";
import { useEffect, useState } from "react";

interface Post {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  post_type: "article" | "thesis" | "note";
  status: "draft" | "published" | "withdrawn";
  byline: string;
  tags: string;
  is_forensic: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

type Filter = "draft" | "published" | "all";

const POST_TYPE_LABEL: Record<string, string> = {
  article: "Article",
  thesis: "Thesis",
  note: "Note",
};

export default function PostsPage() {
  const [filter, setFilter] = useState<Filter>("draft");
  const [posts, setPosts] = useState<Post[]>([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    const path = filter === "all" ? "/v1/posts/" : `/v1/posts/?status=${filter}`;
    const r = await apiGet<{ posts: Post[] }>(path);
    setPosts(r.posts);
  }
  useEffect(() => {
    void load();
  }, [filter]);

  async function publish(id: string) {
    setBusy(true);
    try {
      await apiPost(`/v1/posts/${id}/publish`);
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 20 }}>
        <div className="row" style={{ gap: 6 }}>
          {(["draft", "published", "all"] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`btn sm ${filter === f ? "primary" : ""}`}
            >
              {f === "all" ? "All" : f === "draft" ? "Drafts" : "Published"}
            </button>
          ))}
        </div>
        <Link href="/chat" className="btn sm signal-primary">
          + Draft via chat →
        </Link>
      </div>

      {posts.length === 0 && (
        <div
          className="card flat"
          style={{ textAlign: "center", padding: "48px 24px", color: "var(--ink-mute)" }}
        >
          <p style={{ marginBottom: 8 }}>No {filter === "all" ? "" : filter} posts yet.</p>
          <p style={{ fontSize: 13 }}>
            Drafts start in chat. Say "draft a post about X" and one lands here.
          </p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {posts.map((p) => (
          <article key={p.id} className="card compact">
            <div
              className="row"
              style={{ justifyContent: "space-between", alignItems: "flex-start" }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="row" style={{ gap: 8, marginBottom: 6 }}>
                  <span className="chip">{POST_TYPE_LABEL[p.post_type] ?? p.post_type}</span>
                  <span
                    className={`chip ${p.status === "published" ? "chip-acid" : p.status === "draft" ? "chip-mute" : ""}`}
                  >
                    {p.status}
                  </span>
                  {p.is_forensic ? <span className="chip chip-signal">Forensic</span> : null}
                </div>
                <h3
                  style={{
                    fontSize: 18,
                    fontWeight: 600,
                    letterSpacing: "-0.015em",
                    color: "var(--ink)",
                  }}
                >
                  <Link
                    href={`/posts/${p.id}`}
                    style={{ color: "var(--ink)", textDecoration: "none" }}
                  >
                    {p.title}
                  </Link>
                </h3>
                {p.subtitle && (
                  <p style={{ marginTop: 4, fontSize: 14, color: "var(--ink-3)" }}>{p.subtitle}</p>
                )}
                <p
                  className="mono"
                  style={{ marginTop: 8, fontSize: 11, color: "var(--ink-mute)" }}
                >
                  {p.status === "published" && p.published_at ? (
                    <>
                      Published {new Date(p.published_at).toLocaleDateString()} ·{" "}
                      <Link
                        href={`/p/${p.slug}`}
                        style={{ color: "var(--ink-3)", textDecoration: "underline dotted" }}
                      >
                        /p/{p.slug}
                      </Link>
                    </>
                  ) : (
                    <>Updated {new Date(p.updated_at).toLocaleString()}</>
                  )}
                </p>
              </div>
              <div className="row" style={{ gap: 6 }}>
                <Link href={`/posts/${p.id}`} className="btn sm primary">
                  Edit
                </Link>
                {p.status === "draft" && (
                  <button
                    type="button"
                    className="btn sm ghost"
                    onClick={() => void publish(p.id)}
                    disabled={busy}
                  >
                    {busy ? "…" : "Publish"}
                  </button>
                )}
                {p.status === "published" && (
                  <Link href={`/p/${p.slug}`} className="btn sm ghost">
                    Read
                  </Link>
                )}
                <Link href={`/chat?post=${p.id}`} className="btn sm ghost">
                  Chat
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
