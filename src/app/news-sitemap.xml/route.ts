import { db, articles } from '@/db'
import { eq, desc } from 'drizzle-orm'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://canopticon.com'

    // Get published articles from last 48 hours (Google News requirement)
    const twoDaysAgo = new Date()
    twoDaysAgo.setHours(twoDaysAgo.getHours() - 48)

    const recentArticles = await db
        .select({
            slug: articles.slug,
            headline: articles.headline,
            publishedAt: articles.publishedAt,
            topics: articles.topics,
        })
        .from(articles)
        .where(eq(articles.isDraft, false))
        .orderBy(desc(articles.publishedAt))
        .limit(1000)

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${recentArticles.map(article => `  <url>
    <loc>${baseUrl}/articles/${article.slug}</loc>
    <news:news>
      <news:publication>
        <news:name>Canopticon</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${article.publishedAt ? new Date(article.publishedAt).toISOString() : new Date().toISOString()}</news:publication_date>
      <news:title>${escapeXml(article.headline)}</news:title>
      ${article.topics && article.topics.length > 0 ? `<news:keywords>${article.topics.slice(0, 10).map(escapeXml).join(', ')}</news:keywords>` : ''}
    </news:news>
  </url>`).join('\n')}
</urlset>`

    return new Response(xml, {
        headers: {
            'Content-Type': 'application/xml',
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
