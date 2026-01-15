import { db, articles } from '@/db'
import { eq, desc } from 'drizzle-orm'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://canopticon.com'

    const recentArticles = await db
        .select({
            slug: articles.slug,
            headline: articles.headline,
            summary: articles.summary,
            publishedAt: articles.publishedAt,
            topics: articles.topics,
        })
        .from(articles)
        .where(eq(articles.isDraft, false))
        .orderBy(desc(articles.publishedAt))
        .limit(50)

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Canopticon - Canadian Political Intelligence</title>
    <link>${baseUrl}</link>
    <description>AI-synthesized Canadian political news and analysis</description>
    <language>en-ca</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${baseUrl}/feed.xml" rel="self" type="application/rss+xml"/>
${recentArticles.map(article => `    <item>
      <title>${escapeXml(article.headline)}</title>
      <link>${baseUrl}/articles/${article.slug}</link>
      <guid isPermaLink="true">${baseUrl}/articles/${article.slug}</guid>
      <description>${escapeXml(article.summary || '')}</description>
      <pubDate>${article.publishedAt ? new Date(article.publishedAt).toUTCString() : new Date().toUTCString()}</pubDate>
      ${article.topics && article.topics.length > 0 ? article.topics.map(t => `<category>${escapeXml(t)}</category>`).join('\n      ') : ''}
    </item>`).join('\n')}
  </channel>
</rss>`

    return new Response(rss, {
        headers: {
            'Content-Type': 'application/rss+xml',
            'Cache-Control': 'public, max-age=300',
        },
    })
}

function escapeXml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
}
