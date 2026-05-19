"use client";

// Classic CMS editor for a single post. All fields editable inline —
// title, subtitle, post_type, tags, forensic flag, body markdown. Save
// (PATCH), Publish (POST), Withdraw (DELETE) live in the footer.
// Pattern mirrors the character bio editor at characters/[slug]/page.tsx.

import { ApiError, apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api-client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

interface Post {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  body_md: string;
  body_html: string | null;
  post_type: "article" | "thesis" | "note";
  status: "draft" | "published" | "withdrawn";
  byline: string;
  tags: string;
  is_forensic: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

interface Version {
  id: string;
  version: number;
  change_summary: string | null;
  saved_at: string;
}

interface PostResponse {
  post: Post;
  versions: Version[];
}

interface Snapshot {
  title: string;
  subtitle: string;
  post_type: string;
  tags: string;
  is_forensic: boolean;
  body_md: string;
}

function parseTags(raw: string): string {
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr.map(String).join(", ");
  } catch {
    /* fall through */
  }
  return "";
}

function snapshotFrom(p: Post): Snapshot {
  return {
    title: p.title,
    subtitle: p.subtitle ?? "",
    post_type: p.post_type,
    tags: parseTags(p.tags),
    is_forensic: p.is_forensic === 1,
    body_md: p.body_md,
  };
}

export default function PostEditorPage() {
  const params = useParams<{ id: string }>();
  const postId = params?.id ?? "";

  const [data, setData] = useState<PostResponse | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [postType, setPostType] = useState<"article" | "thesis" | "note">("article");
  const [tagsRaw, setTagsRaw] = useState("");
  const [isForensic, setIsForensic] = useState(false);
  const [bodyMd, setBodyMd] = useState("");
  const [changeSummary, setChangeSummary] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!postId) return;
    try {
      const r = await apiGet<PostResponse>(`/v1/posts/${postId}`);
      setData(r);
      const snap = snapshotFrom(r.post);
      setSnapshot(snap);
      setTitle(snap.title);
      setSubtitle(snap.subtitle);
      setPostType(snap.post_type as "article" | "thesis" | "note");
      setTagsRaw(snap.tags);
      setIsForensic(snap.is_forensic);
      setBodyMd(snap.body_md);
      setChangeSummary("");
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load post");
    }
  }
  useEffect(() => {
    void load();
  }, [postId]);

  const dirty = useMemo(() => {
    if (!snapshot) return false;
    return (
      title !== snapshot.title ||
      subtitle !== snapshot.subtitle ||
      postType !== snapshot.post_type ||
      tagsRaw !== snapshot.tags ||
      isForensic !== snapshot.is_forensic ||
      bodyMd !== snapshot.body_md
    );
  }, [snapshot, title, subtitle, postType, tagsRaw, isForensic, bodyMd]);

  async function save() {
    if (!dirty) return;
    setBusy(true);
    setError(null);
    try {
      const tags = tagsRaw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const payload: Record<string, unknown> = {
        title,
        subtitle: subtitle || null,
        post_type: postType,
        tags,
        is_forensic: isForensic,
        body_md: bodyMd,
      };
      if (changeSummary.trim()) payload.change_summary = changeSummary.trim();
      await apiPatch(`/v1/posts/${postId}`, payload);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (dirty) {
      setError("Save your changes before publishing.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiPost(`/v1/posts/${postId}/publish`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Publish failed");
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    if (!confirm("Withdraw this post? It will be removed from the public site.")) return;
    setBusy(true);
    setError(null);
    try {
      await apiDelete(`/v1/posts/${postId}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Withdraw failed");
    } finally {
      setBusy(false);
    }
  }

  if (!data || !snapshot) {
    return (
      <div className="card flat" style={{ padding: 32, color: "var(--ink-mute)" }}>
        {error ?? "Loading…"}
      </div>
    );
  }
  const { post } = data;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <header className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div className="row" style={{ gap: 8 }}>
          <Link
            href="/posts"
            className="mono"
            style={{ fontSize: 11, color: "var(--ink-mute)", textDecoration: "none" }}
          >
            ← Posts
          </Link>
          <span className="chip">{post.post_type}</span>
          <span
            className={`chip ${
              post.status === "published" ? "chip-acid" : post.status === "draft" ? "chip-mute" : ""
            }`}
          >
            {post.status}
          </span>
          {post.is_forensic ? <span className="chip chip-signal">Forensic</span> : null}
        </div>
        <div className="row" style={{ gap: 6 }}>
          {post.status === "published" && (
            <Link
              href={`/p/${post.slug}`}
              target="_blank"
              rel="noreferrer"
              className="btn sm ghost"
            >
              View public →
            </Link>
          )}
          <Link href={`/chat?post=${postId}`} className="btn sm ghost">
            Open in chat
          </Link>
        </div>
      </header>

      {error && (
        <div
          className="card compact"
          style={{
            borderColor: "var(--signal)",
            color: "var(--signal)",
            background: "color-mix(in srgb, var(--signal) 6%, var(--surface))",
          }}
        >
          {error}
        </div>
      )}

      <section className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Field label="Title">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={inputStyle}
          />
        </Field>

        <Field label="Subtitle">
          <input
            type="text"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="Optional"
            style={inputStyle}
          />
        </Field>

        <div className="row" style={{ gap: 16, alignItems: "flex-start" }}>
          <Field label="Type" style={{ flex: 1 }}>
            <select
              value={postType}
              onChange={(e) => setPostType(e.target.value as "article" | "thesis" | "note")}
              style={inputStyle}
            >
              <option value="article">Article</option>
              <option value="thesis">Thesis</option>
              <option value="note">Note</option>
            </select>
          </Field>
          <Field label="Tags (comma-separated)" style={{ flex: 2 }}>
            <input
              type="text"
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.target.value)}
              placeholder="e.g. carney, finance, governance"
              style={inputStyle}
            />
          </Field>
        </div>

        <Field label="Forensic">
          <div className="row" style={{ gap: 8, fontSize: 13, color: "var(--ink-2)" }}>
            <input
              type="checkbox"
              checked={isForensic}
              onChange={(e) => setIsForensic(e.target.checked)}
            />
            <span>Mark as forensic</span>
            <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>
              · publish-prep gates run on publish
            </span>
          </div>
        </Field>

        <Field label={`Body markdown · ${bodyMd.length.toLocaleString()} chars`}>
          <textarea
            value={bodyMd}
            onChange={(e) => setBodyMd(e.target.value)}
            rows={28}
            spellCheck
            style={{
              ...inputStyle,
              fontFamily: "var(--mono)",
              fontSize: 13,
              lineHeight: 1.55,
              resize: "vertical",
            }}
          />
        </Field>

        <Field label="Change summary (optional)">
          <input
            type="text"
            value={changeSummary}
            onChange={(e) => setChangeSummary(e.target.value)}
            placeholder="e.g. fixed a typo, expanded section 2…"
            style={inputStyle}
          />
        </Field>
      </section>

      <footer
        className="row"
        style={{
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 0",
        }}
      >
        <div className="mono" style={{ fontSize: 11, color: "var(--ink-mute)" }}>
          {dirty ? "Unsaved changes" : `Saved · v${data.versions[0]?.version ?? 1}`}
        </div>
        <div className="row" style={{ gap: 8 }}>
          {post.status === "published" ? (
            <button
              type="button"
              className="btn sm ghost"
              onClick={() => void withdraw()}
              disabled={busy}
            >
              Withdraw
            </button>
          ) : null}
          <button
            type="button"
            className="btn sm ghost"
            onClick={() => {
              setTitle(snapshot.title);
              setSubtitle(snapshot.subtitle);
              setPostType(snapshot.post_type as "article" | "thesis" | "note");
              setTagsRaw(snapshot.tags);
              setIsForensic(snapshot.is_forensic);
              setBodyMd(snapshot.body_md);
              setChangeSummary("");
            }}
            disabled={!dirty || busy}
          >
            Revert
          </button>
          <button
            type="button"
            className="btn sm primary"
            onClick={() => void save()}
            disabled={!dirty || busy}
          >
            {busy ? "…" : "Save"}
          </button>
          {post.status === "draft" && (
            <button
              type="button"
              className="btn sm signal-primary"
              onClick={() => void publish()}
              disabled={busy || dirty}
              title={dirty ? "Save your changes first" : "Publish to the public site"}
            >
              Publish →
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--paper-2)",
  border: "1px solid var(--rule)",
  borderRadius: 6,
  padding: "8px 10px",
  color: "var(--ink)",
  fontSize: 14,
};

function Field({
  label,
  children,
  style,
}: {
  label: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control is passed as children
    <label style={{ display: "flex", flexDirection: "column", gap: 6, ...style }}>
      <span
        className="mono"
        style={{
          fontSize: 11,
          color: "var(--ink-mute)",
          textTransform: "uppercase",
          letterSpacing: 1.2,
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}
