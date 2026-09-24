import { describe, expect, it } from "vitest";
import { renderAnalyticsBeacon, renderPage } from "../src/public/layout";

describe("renderPage og:image", () => {
  it("emits og:image with its dimensions only when given", () => {
    const without = renderPage({ title: "T", body: "<p>x</p>" });
    expect(without).not.toContain("og:image");
    expect(without).toContain('<meta name="twitter:card" content="summary_large_image" />');

    const withImage = renderPage({
      title: "T",
      body: "<p>x</p>",
      ogImage: "https://canopticon.com/og/doc-slug.png",
    });
    expect(withImage).toContain(
      '<meta property="og:image" content="https://canopticon.com/og/doc-slug.png" />',
    );
    expect(withImage).toContain('<meta property="og:image:width" content="1200" />');
    expect(withImage).toContain('<meta property="og:image:height" content="630" />');
    expect(withImage).toContain(
      '<meta name="twitter:image" content="https://canopticon.com/og/doc-slug.png" />',
    );
    expect(withImage).toContain('<meta name="twitter:card" content="summary_large_image" />');
  });
});

describe("Cloudflare Web Analytics beacon", () => {
  it("is emitted before </body> only when the token is set", () => {
    const off = renderPage({ title: "T", body: "<p>x</p>" });
    expect(off).not.toContain("cloudflareinsights");
    const empty = renderPage({ title: "T", body: "<p>x</p>", analyticsToken: "" });
    expect(empty).not.toContain("cloudflareinsights");

    const on = renderPage({ title: "T", body: "<p>x</p>", analyticsToken: "abc123" });
    expect(on).toContain(
      `<script defer src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "abc123"}'></script>\n</body>`,
    );
  });

  it("drops anything that is not a token character", () => {
    expect(renderAnalyticsBeacon("ab'c\"}<")).toContain(`{"token": "abc"}`);
    expect(renderAnalyticsBeacon("'\"")).toBe("");
  });
});
