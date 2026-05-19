import { publicGet } from "@/lib/public-api";
import { renderRss, toRfc822 } from "@/lib/rss";

export const runtime = "edge";

interface ThesesFeed {
  theses: Array<{
    slug: string;
    title: string;
    tier_bluf: string;
    coined_phrase?: string | null;
    published_at: string;
  }>;
}

const SITE = "https://canopticon.com";

export async function GET(): Promise<Response> {
  const r = await publicGet<ThesesFeed>("/v1/public/theses", 60).catch(() => ({ theses: [] }));
  return new Response(
    renderRss({
      title: "Canopticon — Theses",
      link: `${SITE}/theses`,
      description:
        "Forensic-grade theses on Canadian political and economic structure. Each thesis names a structural pattern, banks predictions, and shows its evidence.",
      items: r.theses.slice(0, 50).map((t) => ({
        title: t.coined_phrase ? `${t.title} — "${t.coined_phrase}"` : t.title,
        link: `${SITE}/p/theses/${t.slug}`,
        guid: `thesis:${t.slug}`,
        description: t.tier_bluf,
        pubDate: toRfc822(t.published_at),
      })),
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
