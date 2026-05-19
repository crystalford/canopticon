// Canonical post URL: canopticon.com/p/<slug>. Reads from the CMS posts
// table directly — no cache populator step. body_html was rendered at
// publish time so this page is pure read-through.
//
// `dynamic = "force-dynamic"` (and `revalidate: 0` on the fetch) means
// every request goes through to the API. The previous `revalidate: 60`
// caused a real bug: visiting /p/<slug> before publish cached the 404
// for 60s, so clicking "View public →" right after publishing showed
// stale 404. With force-dynamic the cost is one D1 read per page view,
// which is negligible at our traffic level and gives the operator an
// immediately-correct experience after publishing.

import { publicGet } from "@/lib/public-api";
import { notFound } from "next/navigation";

export const runtime = "edge";
export const dynamic = "force-dynamic";

interface PostDetail {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  body_html: string;
  post_type: "article" | "thesis" | "note";
  byline: string | null;
  tags: string;
  is_forensic: number;
  published_at: string;
  updated_at: string;
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = await publicGet<{ post: PostDetail }>(`/v1/public/posts/${slug}`, 0).catch(() => null);
  if (!r) notFound();
  const p = r.post;
  const tags = safeJsonArray(p.tags);

  return (
    <article className="mx-auto max-w-3xl px-6 py-12">
      <p className="mb-2 font-mono text-[10.5px] uppercase tracking-wider text-[var(--ink-mute)]">
        CANOPTICON · {new Date(p.published_at).toLocaleDateString()}
        {p.is_forensic ? " · Forensic" : ""}
        {p.byline ? ` · By ${p.byline}` : ""}
      </p>
      <h1 className="font-serif text-5xl leading-tight text-[var(--ink)]">{p.title}</h1>
      {p.subtitle && (
        <p className="mt-3 font-serif text-xl italic text-[var(--ink-3)]">{p.subtitle}</p>
      )}

      <PostBody html={p.body_html} />

      {tags.length > 0 && (
        <p className="mt-12 border-t border-[var(--rule)] pt-6 font-mono text-[10.5px] uppercase tracking-wider text-[var(--ink-mute)]">
          {tags.map((t) => `#${t}`).join(" · ")}
        </p>
      )}
    </article>
  );
}

function safeJsonArray(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

// body_html is operator-authored (Cloudflare Access gates the chat that
// generates posts) and pre-rendered at publish time by the CMS markdown
// renderer. Setting innerHTML is intentional here.
function PostBody({ html }: { html: string }) {
  return (
    <div
      className="mt-8 font-serif text-lg leading-relaxed text-[var(--ink)] [&>blockquote]:my-4 [&>blockquote]:border-l-2 [&>blockquote]:border-[var(--signal)] [&>blockquote]:pl-4 [&>blockquote]:italic [&>h2]:mt-8 [&>h2]:font-serif [&>h2]:text-3xl [&>h3]:mt-6 [&>h3]:font-serif [&>h3]:text-2xl [&>hr]:my-8 [&>hr]:border-[var(--rule)] [&>ol]:my-4 [&>ol]:list-decimal [&>ol]:pl-6 [&>p]:my-4 [&>pre]:my-4 [&>pre]:overflow-auto [&>pre]:bg-[var(--paper-2)] [&>pre]:p-3 [&>ul]:my-4 [&>ul]:list-disc [&>ul]:pl-6 [&_a.citation-chip]:rounded-sm [&_a.citation-chip]:bg-[var(--paper-2)] [&_a.citation-chip]:px-1 [&_a.citation-chip]:font-mono [&_a.citation-chip]:text-[11px] [&_a.citation-chip]:text-[var(--signal)]"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted operator output
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
