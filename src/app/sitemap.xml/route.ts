import { db, articles } from '@/db'
import { eq, desc } from 'drizzle-orm'

export const dynamic = 'force-dynamic'
export const revalidate = 3600 // Revalidate every hour

export async function GET() {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://canopticon.com'

    // Get all published articles
    const allArticles = await db
        .select({
            slug: articles.slug,
            updatedAt: articles.updatedAt,
        })
        .from(articles)
        .where(eq(articles.isDraft, false))
        .orderBy(desc(articles.publishedAt))

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>1.0</priority>
  </url>
${allArticles.map(article => `  <url>
    <loc>${baseUrl}/articles/${article.slug}</loc>
    <lastmod>${article.updatedAt ? new Date(article.updatedAt).toISOString() : new Date().toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`).join('\n')}
</urlset>`

    return new Response(xml, {
        headers: {
            'Content-Type': 'application/xml',
            'Cache-Control': 'public, max-age=3600',
        },
    })
}
