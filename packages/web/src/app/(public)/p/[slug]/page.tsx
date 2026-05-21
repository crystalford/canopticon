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
//
// On fetch failure: instead of notFound() (which renders the generic
// 404 page and hides the cause), render a visible diagnostic that
// shows the exact API URL attempted, the response status, and the
// error body. Lets the operator see *why* a "should be live" post
// isn't showing up.

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

interface FetchOutcome {
  ok: boolean;
  status: number;
  url: string;
  bodyPreview: string;
  post?: PostDetail;
}

async function fetchPost(slug: string): Promise<FetchOutcome> {
  const baseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
  const url = `${baseUrl}/v1/public/posts/${encodeURIComponent(slug)}`;
  try {
    const res = await fetch(url, {
      next: { revalidate: 0 },
      headers: { accept: "application/json" },
    });
    const text = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        url,
        bodyPreview: text.slice(0, 500),
      };
    }
    const json = JSON.parse(text) as { post: PostDetail };
    return { ok: true, status: res.status, url, bodyPreview: "", post: json.post };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      url,
      bodyPreview: `Fetch error: ${(err as Error).message}`,
    };
  }
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = await fetchPost(slug);
  if (!r.ok || !r.post) {
    return <Diagnostic slug={slug} outcome={r} />;
  }
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

function Diagnostic({ slug, outcome }: { slug: string; outcome: FetchOutcome }) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 font-mono text-sm">
      <h1 className="text-2xl font-bold">Post not found: {slug}</h1>
      <p className="mt-2 text-[var(--ink-3)]">
        Diagnostic info — the public site fetches the API directly. Below is exactly what came back.
      </p>
      <dl className="mt-6 grid grid-cols-[120px_1fr] gap-y-2 text-[12px]">
        <dt className="text-[var(--ink-mute)]">slug</dt>
        <dd>{slug}</dd>
        <dt className="text-[var(--ink-mute)]">api url</dt>
        <dd className="break-all">{outcome.url}</dd>
        <dt className="text-[var(--ink-mute)]">status</dt>
        <dd>{outcome.status || "(network error)"}</dd>
        <dt className="text-[var(--ink-mute)]">body</dt>
        <dd className="whitespace-pre-wrap break-all">{outcome.bodyPreview || "(empty)"}</dd>
      </dl>
      <p className="mt-8 text-[12px] text-[var(--ink-mute)]">
        If status=404 and body is `{"{"}error: post not found{"}"}` then the post isn't in the D1
        the public Worker reads from — either it isn't `status='published'` or the slug doesn't
        match. If status=200 but post is missing, the API contract changed. If status=0, the Worker
        is unreachable.
      </p>
    </main>
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
