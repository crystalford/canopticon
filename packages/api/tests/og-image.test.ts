import { describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import {
  OG_UNCONFIGURED_REASON,
  generateOgImage,
  ogKey,
  renderOgCard,
} from "../src/graph/lib/og-image";

describe("renderOgCard", () => {
  it("is a 1200×630 card in the site's look, with the title escaped", () => {
    const html = renderOgCard({ title: 'Rates <b>"rose"</b> & fell', kind: "essay" });
    expect(html).toContain("width: 1200px; height: 630px");
    expect(html).toContain("#0b0c0d");
    expect(html).toContain("#e0433c");
    expect(html).toContain("Rates &lt;b&gt;&quot;rose&quot;&lt;/b&gt; &amp; fell");
    expect(html).not.toContain("<b>");
    expect(html).toContain(">Essay<");
    expect(html).toContain('class="wordmark">canopticon<');
    expect(html).toContain('class="domain">canopticon.com<');
    expect(html).not.toContain('class="figure"');
  });

  it("shows one key figure when given", () => {
    const html = renderOgCard({
      title: "T",
      kind: "research",
      subtitle: "A dek",
      figure: { figure: "43%", measures: "of renters spent over 30% of income on housing" },
    });
    expect(html).toContain('<span class="n">43%</span>');
    expect(html).toContain("of renters spent over 30% of income on housing");
    expect(html).toContain('class="subtitle">A dek<');
    expect(html).toContain(">Research<");
  });
});

function fakeEnv(opts: {
  configured: boolean;
  fetchImpl?: typeof fetch;
  puts: Array<{ key: string; bytes: number; type: string | undefined }>;
}): Env {
  const rows: Record<string, unknown[]> = {
    pieces: [{ title: "Doc", subtitle: null, kind: "research", slug: "doc-slug" }],
    aeo_findings: [{ figure: "12", measures: "things" }],
  };
  const DB = {
    prepare: (sql: string) => {
      const table = sql.includes("aeo_findings") ? "aeo_findings" : "pieces";
      return {
        bind: () => ({
          first: async () => rows[table]?.[0] ?? null,
          all: async () => ({ results: rows[table] ?? [], meta: {} }),
          run: async () => ({ meta: { changes: 0 } }),
        }),
      };
    },
  } as unknown as D1Database;
  const FILES = {
    put: async (
      key: string,
      value: ArrayBuffer,
      o?: { httpMetadata?: { contentType?: string } },
    ) => {
      opts.puts.push({ key, bytes: value.byteLength, type: o?.httpMetadata?.contentType });
      return {};
    },
  } as unknown as R2Bucket;
  return {
    DB,
    FILES,
    CLOUDFLARE_ACCOUNT_ID: opts.configured ? "acct123" : "",
    CLOUDFLARE_API_TOKEN: opts.configured ? "tok456" : undefined,
  } as unknown as Env;
}

describe("generateOgImage", () => {
  it("is inert without Browser Rendering configured: stated reason, nothing written", async () => {
    const puts: Array<{ key: string; bytes: number; type: string | undefined }> = [];
    const r = await generateOgImage(fakeEnv({ configured: false, puts }), "u", "p1");
    expect(r).toEqual({ ok: false, reason: OG_UNCONFIGURED_REASON });
    expect(r.ok === false && r.reason).toContain("CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN");
    expect(puts).toEqual([]);
  });

  it("screenshots the card and PUTs the PNG at og/<slug>.png", async () => {
    const puts: Array<{ key: string; bytes: number; type: string | undefined }> = [];
    const seen: Array<{ url: string; init: RequestInit }> = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      seen.push({ url: String(url), init: init ?? {} });
      return new Response(new Uint8Array([137, 80, 78, 71]), {
        status: 200,
        headers: { "content-type": "image/png" },
      });
    }) as typeof fetch;
    try {
      const r = await generateOgImage(fakeEnv({ configured: true, puts }), "u", "p1");
      expect(r).toEqual({ ok: true, key: "og/doc-slug.png", bytes: 4 });
    } finally {
      globalThis.fetch = realFetch;
    }
    expect(seen).toHaveLength(1);
    expect(seen[0]?.url).toBe(
      "https://api.cloudflare.com/client/v4/accounts/acct123/browser-rendering/screenshot",
    );
    const headers = seen[0]?.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok456");
    const body = JSON.parse(String(seen[0]?.init.body)) as {
      html: string;
      viewport: { width: number; height: number };
      screenshotOptions: { type: string };
    };
    expect(body.viewport).toEqual({ width: 1200, height: 630 });
    expect(body.screenshotOptions).toEqual({ type: "png" });
    expect(body.html).toContain(">Doc<");
    expect(body.html).toContain('<span class="n">12</span>');
    expect(puts).toEqual([{ key: ogKey("doc-slug"), bytes: 4, type: "image/png" }]);
  });

  it("returns the status on an HTTP error and writes nothing", async () => {
    const puts: Array<{ key: string; bytes: number; type: string | undefined }> = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response("nope", { status: 503 })) as typeof fetch;
    try {
      const r = await generateOgImage(fakeEnv({ configured: true, puts }), "u", "p1");
      expect(r).toEqual({ ok: false, reason: "Browser Rendering returned HTTP 503" });
    } finally {
      globalThis.fetch = realFetch;
    }
    expect(puts).toEqual([]);
  });
});
