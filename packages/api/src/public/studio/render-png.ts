// Render arbitrary HTML to a PNG via Cloudflare Browser Rendering's
// /screenshot endpoint (spec v2.6 Part 27, Studio Stage A).
//
// This is the single shared helper that every static-format Produce flow
// goes through — card → PNG, thread → 4 × PNG, carousel → N × PNG. It
// takes a self-contained HTML document (the face composition + its CSS,
// nothing else — no site chrome, no nav) and a viewport, and returns
// PNG bytes.
//
// Configuration:
//   - CLOUDFLARE_ACCOUNT_ID  set in wrangler.toml [vars] (already there)
//   - CLOUDFLARE_API_TOKEN   set as a Worker secret with the
//                            "Browser Rendering Edit" permission
//
// When unconfigured, the helper returns an explicit ConfigurationError
// so the operator UI can show a clear "set up Browser Rendering" hint
// instead of a generic 500.

export interface Viewport {
  width: number;
  height: number;
}

export interface RenderPngResult {
  ok: boolean;
  png?: ArrayBuffer;
  error?: string;
  unconfigured?: boolean;
}

interface Env {
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
}

export async function renderHtmlToPng(
  env: Env,
  html: string,
  viewport: Viewport,
): Promise<RenderPngResult> {
  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_API_TOKEN) {
    return {
      ok: false,
      unconfigured: true,
      error:
        "Cloudflare Browser Rendering not configured. Add CLOUDFLARE_ACCOUNT_ID to wrangler.toml [vars] and run `wrangler secret put CLOUDFLARE_API_TOKEN` with a token scoped to 'Browser Rendering Edit'.",
    };
  }
  const url = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/browser-rendering/screenshot`;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        html,
        viewport,
        screenshotOptions: { type: "png", omitBackground: false },
        // Wait for the page to settle so webfonts/SVGs are painted.
        gotoOptions: { waitUntil: "networkidle0" },
      }),
    });
    if (!resp.ok) {
      const text = await resp.text();
      return {
        ok: false,
        error: `Browser Rendering returned ${resp.status}: ${text.slice(0, 400)}`,
      };
    }
    // /screenshot returns binary PNG, not JSON.
    const png = await resp.arrayBuffer();
    return { ok: true, png };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
