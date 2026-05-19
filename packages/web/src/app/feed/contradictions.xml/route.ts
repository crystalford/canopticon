import { publicGet } from "@/lib/public-api";
import { renderRss, toRfc822 } from "@/lib/rss";

export const runtime = "edge";

interface ContraFeed {
  contradictions: Array<{
    contradiction_id: string;
    slug?: string;
    posture: string;
    resolution_reasoning: string | null;
    payload: { headline?: string };
    created_at?: string;
  }>;
}

const SITE = "https://canopticon.com";

export async function GET(): Promise<Response> {
  const r = await publicGet<ContraFeed>("/v1/public/contradictions", 60).catch(() => ({
    contradictions: [],
  }));
  return new Response(
    renderRss({
      title: "Canopticon — Contradictions",
      link: `${SITE}/contradictions`,
      description:
        "Pairs of claims that contradict, with their posture — open, machloket (both stand), or resolved.",
      items: r.contradictions.slice(0, 100).map((c) => ({
        title: c.payload?.headline ?? `[${c.posture.replace(/_/g, " ")}] contradiction`,
        link: `${SITE}/p/contradictions`,
        guid: `contradiction:${c.contradiction_id}`,
        description: c.resolution_reasoning ?? `Posture: ${c.posture}`,
        pubDate: c.created_at ? toRfc822(c.created_at) : new Date().toUTCString(),
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
