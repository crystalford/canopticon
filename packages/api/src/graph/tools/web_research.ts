// Web research tools — let the chat agent look things up without leaving
// the Cloudflare stack.
//
// Two tiers, gated by cost:
//
//   FREE (auto-execute):
//     - wikipedia_search(query)  — disambiguation list, top 5 page candidates
//     - wikipedia_lookup(title)  — full summary of one page
//
//   PAID + confirm-required:
//     - web_search(query)        — DuckDuckGo via Cloudflare Browser Rendering
//     - web_fetch_rendered(url)  — JS-rendered page content via Browser Rendering
//
// Wikipedia uses the public REST API (no key, no recurring cost).
// Browser Rendering goes through Cloudflare's REST endpoint with an API token.
// Estimated cost per call is surfaced to the operator in the confirm card
// description so nothing bills without explicit approval.

import type { ToolDef } from "./index";

export const BROWSER_RENDERING_PER_PAGE_CENTS = 0.5; // ~$0.005

// ---------------------------------------------------------------------------
// Wikipedia — free, auto
// ---------------------------------------------------------------------------

const WIKI_SEARCH_BASE = "https://en.wikipedia.org/w/rest.php/v1/search/page";
const WIKI_SUMMARY_BASE = "https://en.wikipedia.org/api/rest_v1/page/summary";

interface WikiSearchHit {
  id: number;
  key: string;
  title: string;
  excerpt: string;
  description: string | null;
}

interface WikiSummary {
  title: string;
  description: string | null;
  extract: string;
  content_urls: { desktop: { page: string } };
  thumbnail?: { source: string };
}

export const wikipediaSearch: ToolDef = {
  name: "wikipedia_search",
  description:
    "Search Wikipedia for pages matching a query. Returns top 5 candidates with one-line descriptions so the agent can pick the right page (disambiguation step). Free. Use this BEFORE wikipedia_lookup unless you already know the exact page title.",
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string" },
      lang: { type: "string", description: "Wikipedia language code, default 'en'." },
    },
    required: ["query"],
  },
  confirm: false,
  async exec(_ctx, input) {
    const q = String(input.query ?? "");
    const lang = String(input.lang ?? "en");
    const url = `${WIKI_SEARCH_BASE.replace("en.wikipedia.org", `${lang}.wikipedia.org`)}?q=${encodeURIComponent(q)}&limit=5`;
    try {
      const r = await fetch(url, { headers: { "user-agent": "Canopticon/1.0 (research)" } });
      if (!r.ok) {
        return {
          output: `Wikipedia search failed: ${r.status} ${r.statusText}`,
          side_effects: [],
        };
      }
      const data = (await r.json()) as { pages?: WikiSearchHit[] };
      const pages = data.pages ?? [];
      if (pages.length === 0) {
        return { output: `No Wikipedia pages match "${q}".`, side_effects: [] };
      }
      const lines = pages.map((p, i) => {
        const desc = p.description ? ` — ${p.description}` : "";
        const excerpt = p.excerpt
          ? p.excerpt
              .replace(/<[^>]+>/g, "")
              .trim()
              .slice(0, 120)
          : "";
        return `${i + 1}. **${p.title}**${desc}${excerpt ? `\n   ${excerpt}` : ""}`;
      });
      return {
        output: `Wikipedia search for "${q}":\n\n${lines.join("\n")}\n\nUse wikipedia_lookup with the title that matches.`,
        side_effects: [],
      };
    } catch (err) {
      return { output: `Wikipedia search error: ${(err as Error).message}`, side_effects: [] };
    }
  },
};

export const wikipediaLookup: ToolDef = {
  name: "wikipedia_lookup",
  description:
    "Fetch the Wikipedia summary for a specific page title. Returns ~500 words of clean prose, plus the article URL (use as a source citation) and the page image. Free. Use this AFTER wikipedia_search to read the right page.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      lang: { type: "string", description: "Wikipedia language code, default 'en'." },
    },
    required: ["title"],
  },
  confirm: false,
  async exec(_ctx, input) {
    const title = String(input.title ?? "").replace(/\s+/g, "_");
    const lang = String(input.lang ?? "en");
    const url = `${WIKI_SUMMARY_BASE.replace("en.wikipedia.org", `${lang}.wikipedia.org`)}/${encodeURIComponent(title)}`;
    try {
      const r = await fetch(url, { headers: { "user-agent": "Canopticon/1.0 (research)" } });
      if (r.status === 404) {
        return {
          output: `Wikipedia has no page for "${input.title}". Try wikipedia_search to find the right title.`,
          side_effects: [],
        };
      }
      if (!r.ok) {
        return {
          output: `Wikipedia lookup failed: ${r.status} ${r.statusText}`,
          side_effects: [],
        };
      }
      const data = (await r.json()) as WikiSummary;
      const lines = [
        `# ${data.title}`,
        data.description ? `_${data.description}_` : "",
        "",
        data.extract,
        "",
        `Source: ${data.content_urls.desktop.page}`,
      ].filter(Boolean);
      return {
        output: lines.join("\n"),
        side_effects: [
          {
            kind: "source",
            id: data.content_urls.desktop.page,
            summary: `Wikipedia — ${data.title}`,
          },
        ],
      };
    } catch (err) {
      return { output: `Wikipedia lookup error: ${(err as Error).message}`, side_effects: [] };
    }
  },
};

// ---------------------------------------------------------------------------
// Cloudflare Browser Rendering — paid, confirm-required
// ---------------------------------------------------------------------------

/** Exported for reuse by record-builder.ts's autonomous fetch-fallback path —
 *  same client, different caller (a cron sweep instead of a confirmed chat
 *  tool call), gated by the cost ledger instead of an operator confirm
 *  card. See cost/approve.ts + the "browser_rendering.fetch" whitelist
 *  entry in lib/seed.ts for the unattended-use cost containment. */
export async function callBrowserRendering(
  env: { CLOUDFLARE_ACCOUNT_ID?: string; CLOUDFLARE_API_TOKEN?: string },
  endpoint: "content" | "scrape" | "json",
  body: Record<string, unknown>,
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_API_TOKEN) {
    return {
      ok: false,
      error:
        "Cloudflare Browser Rendering not configured. Set CLOUDFLARE_ACCOUNT_ID in wrangler.toml [vars] and CLOUDFLARE_API_TOKEN as a Worker secret (with 'Browser Rendering Edit' permission).",
    };
  }
  const url = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/browser-rendering/${endpoint}`;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = (await r.json()) as { success?: boolean; result?: unknown; errors?: unknown[] };
    if (!r.ok || data.success === false) {
      return { ok: false, error: `Browser Rendering failed: ${JSON.stringify(data.errors)}` };
    }
    return { ok: true, data: data.result };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export const webSearch: ToolDef = {
  name: "web_search",
  description: `Search the open web via DuckDuckGo (rendered through Cloudflare Browser Rendering). Returns top 10 results. ESTIMATED COST: ~${BROWSER_RENDERING_PER_PAGE_CENTS}¢ per search ($0.005). Operator confirms before this runs. Use ONLY when Wikipedia didn't find what you need.`,
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query." },
    },
    required: ["query"],
  },
  confirm: true,
  async exec({ env }, input) {
    const query = String(input.query ?? "");
    const ddgUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const r = await callBrowserRendering(env, "scrape", {
      url: ddgUrl,
      elements: [
        { selector: ".result__a" },
        { selector: ".result__snippet" },
        { selector: ".result__url" },
      ],
    });
    if (!r.ok) {
      return { output: r.error ?? "Browser Rendering call failed.", side_effects: [] };
    }
    const result = r.data as Array<{
      selector: string;
      results: Array<{ text?: string; attributes?: Array<{ name: string; value: string }> }>;
    }>;
    const titles = result.find((r) => r.selector === ".result__a")?.results ?? [];
    const snippets = result.find((r) => r.selector === ".result__snippet")?.results ?? [];
    const urls = result.find((r) => r.selector === ".result__url")?.results ?? [];
    const items: string[] = [];
    for (let i = 0; i < Math.min(10, titles.length); i++) {
      const title = titles[i]?.text?.trim() ?? "(no title)";
      const snippet = snippets[i]?.text?.trim() ?? "";
      const urlText = urls[i]?.text?.trim() ?? "";
      items.push(`${i + 1}. **${title}**\n   ${urlText}\n   ${snippet}`);
    }
    if (items.length === 0) {
      return { output: `No web results for "${query}".`, side_effects: [] };
    }
    return {
      output: `Web search for "${query}" (top ${items.length}):\n\n${items.join("\n\n")}\n\nUse fetch_url or web_fetch_rendered to pull any of these URLs into the substrate.`,
      side_effects: [],
    };
  },
};

export const webFetchRendered: ToolDef = {
  name: "web_fetch_rendered",
  description: `Fetch a page through Cloudflare Browser Rendering (executes JavaScript, returns final HTML). Use ONLY when fetch_url fails because the page needs JS to render. ESTIMATED COST: ~${BROWSER_RENDERING_PER_PAGE_CENTS}¢ per fetch ($0.005). Operator confirms before this runs.`,
  input_schema: {
    type: "object",
    properties: {
      url: { type: "string" },
    },
    required: ["url"],
  },
  confirm: true,
  async exec({ env }, input) {
    const url = String(input.url ?? "");
    const r = await callBrowserRendering(env, "content", { url });
    if (!r.ok) {
      return { output: r.error ?? "Browser Rendering call failed.", side_effects: [] };
    }
    const html = String(r.data ?? "");
    // Strip tags for a quick text preview; the full HTML is in r.data if a
    // tool wants to ingest it. We keep this short to avoid blowing the
    // context window.
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 8000);
    return {
      output: `Fetched ${url} (${html.length} bytes HTML, ${text.length} text chars):\n\n${text}\n\nCall create_source if you want this in the substrate.`,
      side_effects: [],
    };
  },
};

export const WEB_RESEARCH_TOOLS: ToolDef[] = [
  wikipediaSearch,
  wikipediaLookup,
  webSearch,
  webFetchRendered,
];
