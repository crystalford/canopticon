import { publicGet } from "@/lib/public-api";
import { renderRss, toRfc822 } from "@/lib/rss";

export const runtime = "edge";

interface ArticleFeed {
  articles: Array<{
    slug: string;
    title: string;
    subtitle?: string | null;
    author?: string | null;
    published_at: string;
  }>;
}

interface PostFeed {
  posts: Array<{
    slug: string;
    title: string;
    subtitle?: string | null;
    byline?: string | null;
    published_at: string;
  }>;
}

const SITE = "https://canopticon.com";

export async function GET(): Promise<Response> {
  const [legacy, posts] = await Promise.all([
    publicGet<ArticleFeed>("/v1/public/articles", 60).catch(() => ({ articles: [] })),
    publicGet<PostFeed>("/v1/public/posts", 60).catch(() => ({ posts: [] })),
  ]);

  // Combine both shapes — posts (the new CMS) and articles (legacy cache).
  const merged = [
    ...posts.posts.map((p) => ({
      title: p.title,
      link: `${SITE}/p/${p.slug}`,
      guid: `post:${p.slug}`,
      description: p.subtitle ?? undefined,
      pubDate: toRfc822(p.published_at),
      author: p.byline ?? undefined,
    })),
    ...legacy.articles.map((a) => ({
      title: a.title,
      link: `${SITE}/p/articles/${a.slug}`,
      guid: `article:${a.slug}`,
      description: a.subtitle ?? undefined,
      pubDate: toRfc822(a.published_at),
      author: a.author ?? undefined,
    })),
  ].sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

  return new Response(
    renderRss({
      title: "Canopticon — Articles",
      link: `${SITE}/articles`,
      description: "Forensic intelligence on Canadian political and economic structure.",
      items: merged.slice(0, 50),
    }),
    {
      status: 200,
      headers: {
        "content-type": "application/xml; charset=utf-8",
        "cache-control": "public, max-age=300, s-maxage=3600",
      },
    },
  );
}
