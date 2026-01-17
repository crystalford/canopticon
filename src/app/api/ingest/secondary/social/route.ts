import { NextRequest, NextResponse } from 'next/server'
import { db, secondaryArticles, secondarySources } from '@/db'
import { fetchSocialPost } from '@/lib/ingestion/social-fetcher'
import { eq } from 'drizzle-orm'

/**
 * POST /api/ingest/secondary/social
 * Ingest a social media post or opinion piece URL for analysis
 */
export async function POST(request: NextRequest) {
    try {
        const { url, type } = await request.json()

        if (!url) {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 })
        }

        // 1. Try to fetch content
        const post = await fetchSocialPost(url)

        if (!post) {
            return NextResponse.json(
                { error: 'Could not fetch content. Supported platforms: Bluesky, Reddit' },
                { status: 400 }
            )
        }

        // 2. Find or Create the "Secondary Source" (Platform)
        // For MVP we just group by platform name e.g. "Bluesky (UserHandle)" or just "Bluesky"
        // Let's keep it clean: Source = "Bluesky", Name = "Bluesky"
        let sourceName = post.platform === 'bluesky' ? 'Bluesky' : 'Reddit'

        let source = await db.query.secondarySources.findFirst({
            where: eq(secondarySources.name, sourceName)
        })

        if (!source) {
            const [newSource] = await db.insert(secondarySources).values({
                name: sourceName,
                type: 'social_platform',
                baseUrl: post.platform === 'bluesky' ? 'bsky.app' : 'reddit.com',
                reliabilityScore: 0 // Neutral by default
            }).returning()
            source = newSource
        }

        // 3. Create the Secondary Article
        // Check duplication
        const existing = await db.query.secondaryArticles.findFirst({
            where: eq(secondaryArticles.originalUrl, url)
        })

        if (existing) {
            return NextResponse.json({
                success: true,
                message: 'Article already ingested',
                id: existing.id
            })
        }

        const [article] = await db.insert(secondaryArticles).values({
            secondarySourceId: source.id,
            originalUrl: url,
            title: post.platform === 'reddit' ? post.content.split('\n')[0].slice(0, 100) : `Post by ${post.author}`,
            author: post.author,
            content: post.content,
            publishedAt: post.publishedAt,
            metadata: post.metadata,
            sentimentScore: 0
        }).returning()

        return NextResponse.json({
            success: true,
            message: 'Social content ingested successfully',
            article
        })

    } catch (error) {
        console.error('Social ingestion error:', error)
        return NextResponse.json(
            { error: 'Internal server error during ingestion' },
            { status: 500 }
        )
    }
}
