// Canonical post URL: canopticon.com/p/<slug>. Reads from the CMS posts
// table directly — no cache populator step. body_html was rendered at
// publish time so this page is pure read-through.

import { publicGet } from "@/lib/public-api";
import { notFound } from "next/navigation";

export const runtime = "edge";

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
  const r = await publicGet<{ post: PostDetail }>(`/v1/public/posts/${slug}`, 60).catch(() => null);
  if (!r) notFound();
  const p = r.post;
  const tags = safeJsonArray(p.tags);

  return (
    <article className="mx-auto max-w-3xl px-6 py-12">
      <p className="mb-2 font-mono text-[10.5px] uppercase tracking-wider text-[#5c4a3d]">
        CANOPTICON · {new Date(p.published_at).toLocaleDateString()}
        {p.is_forensic ? " · Forensic" : ""}
        {p.byline ? ` · By ${p.byline}` : ""}
      </p>
      <h1 className="font-serif text-5xl leading-tight text-[#1a1410]">{p.title}</h1>
      {p.subtitle && (
        <p className="mt-3 font-serif text-xl italic text-[#1a1410]/70">{p.subtitle}</p>
      )}

      <PostBody html={p.body_html} />

      {tags.length > 0 && (
        <p className="mt-12 border-t border-[#1a1410]/15 pt-6 font-mono text-[10.5px] uppercase tracking-wider text-[#5c4a3d]">
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
      className="mt-8 font-serif text-lg leading-relaxed text-[#1a1410] [&>blockquote]:my-4 [&>blockquote]:border-l-2 [&>blockquote]:border-[#9c2333] [&>blockquote]:pl-4 [&>blockquote]:italic [&>h2]:mt-8 [&>h2]:font-serif [&>h2]:text-3xl [&>h3]:mt-6 [&>h3]:font-serif [&>h3]:text-2xl [&>hr]:my-8 [&>hr]:border-[#1a1410]/15 [&>ol]:my-4 [&>ol]:list-decimal [&>ol]:pl-6 [&>p]:my-4 [&>pre]:my-4 [&>pre]:overflow-auto [&>pre]:bg-[#ede4d2] [&>pre]:p-3 [&>ul]:my-4 [&>ul]:list-disc [&>ul]:pl-6 [&_a.citation-chip]:rounded-sm [&_a.citation-chip]:bg-[#ede4d2] [&_a.citation-chip]:px-1 [&_a.citation-chip]:font-mono [&_a.citation-chip]:text-[11px] [&_a.citation-chip]:text-[#9c2333]"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted operator output
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
