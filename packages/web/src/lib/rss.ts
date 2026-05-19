// Tiny RSS 2.0 builder. No deps. We escape only what the spec actually
// requires for CDATA-free output: &, <, >. Newlines stay as-is.

export interface RssItem {
  title: string;
  link: string;
  guid: string;
  description?: string | undefined;
  pubDate: string; // RFC 822
  author?: string | undefined;
}

export interface RssFeed {
  title: string;
  link: string;
  description: string;
  items: RssItem[];
}

export function renderRss(feed: RssFeed): string {
  const lastBuildDate = new Date().toUTCString();
  const itemsXml = feed.items
    .map(
      (i) => `    <item>
      <title>${esc(i.title)}</title>
      <link>${esc(i.link)}</link>
      <guid isPermaLink="false">${esc(i.guid)}</guid>
      <pubDate>${esc(i.pubDate)}</pubDate>
      ${i.author ? `<author>${esc(i.author)}</author>` : ""}
      ${i.description ? `<description>${esc(i.description)}</description>` : ""}
    </item>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${esc(feed.title)}</title>
    <link>${esc(feed.link)}</link>
    <description>${esc(feed.description)}</description>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
${itemsXml}
  </channel>
</rss>`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function toRfc822(iso: string): string {
  return new Date(iso).toUTCString();
}
