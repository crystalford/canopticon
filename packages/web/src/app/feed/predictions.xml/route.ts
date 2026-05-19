import { publicGet } from "@/lib/public-api";
import { renderRss, toRfc822 } from "@/lib/rss";

export const runtime = "edge";

interface PredictionsFeed {
  predictions: Array<{
    prediction_id: string;
    slug?: string;
    statement: string;
    confidence_pct: number;
    resolution_horizon: string;
    status: string;
    created_at?: string;
  }>;
}

const SITE = "https://canopticon.com";

export async function GET(): Promise<Response> {
  const r = await publicGet<PredictionsFeed>("/v1/public/predictions", 60).catch(() => ({
    predictions: [],
  }));
  return new Response(
    renderRss({
      title: "Canopticon — Predictions",
      link: `${SITE}/predictions`,
      description:
        "Calibrated predictions banked against forensic theses. Brier-scored at resolution.",
      items: r.predictions.slice(0, 100).map((p) => ({
        title: `[${p.confidence_pct}%] ${p.statement.slice(0, 120)}`,
        link: `${SITE}/p/predictions`,
        guid: `prediction:${p.prediction_id}`,
        description: `Resolves by ${p.resolution_horizon}. Status: ${p.status}.`,
        pubDate: p.created_at ? toRfc822(p.created_at) : new Date().toUTCString(),
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
