import { NextResponse } from 'next/server'
import { db, videoClips, articles, automations } from '@/db'
import { eq } from 'drizzle-orm'
import { TwitterApi } from 'twitter-api-v2'

export const dynamic = 'force-dynamic'

// Webhook for Apify Actor completion
export async function POST(req: Request) {
    const { searchParams } = new URL(req.url)
    const clipId = searchParams.get('clipId')
    const articleId = searchParams.get('articleId')
    const automationId = searchParams.get('automationId')

    if (!clipId) {
        return NextResponse.json({ error: 'Missing clipId' }, { status: 400 })
    }

    try {
        const payload = await req.json()
        console.log(`[webhook/apify] Received callback for clip ${clipId}. Status: ${payload.status}`)

        // payload.resource.defaultDatasetId is where the items are
        const datasetId = payload.resource?.defaultDatasetId
        if (!datasetId) {
            console.warn('[webhook/apify] No datasetId in payload')
            return NextResponse.json({ ok: true }) // Still return OK to Apify
        }

        // Fetch dataset items from Apify
        const apifyToken = process.env.APIFY_API_TOKEN
        const res = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyToken}`)
        if (!res.ok) {
            throw new Error(`Failed to fetch dataset ${datasetId}`)
        }

        const items = await res.json()
        const clipUrl = items && items.length > 0 ? items[0].url : null

        if (!clipUrl) {
            throw new Error('No clip URL found in dataset')
        }

        // Update Clip in DB
        const [updatedClip] = await db.update(videoClips)
            .set({ status: 'done', clipUrl, processedAt: new Date() })
            .where(eq(videoClips.id, clipId))
            .returning()

        console.log(`[webhook/apify] Clip ${clipId} finalized: ${clipUrl}`)

        // TRIGGER SOCIAL POSTING if article and automation info is provided
        if (articleId && automationId && updatedClip) {
            try {
                const automation = await db.query.automations.findFirst({ where: eq(automations.id, automationId) })
                const article = await db.query.articles.findFirst({ where: eq(articles.id, articleId) })

                if (automation && article) {
                    console.log(`[webhook/apify] Triggering social post for Article: ${article.title}`)

                    // Import runner helpers dynamically to avoid circular dependencies if any
                    const { generateAndPostThread, generateAndPostSingle } = await import('@/lib/automations/runner')
                    const config = automation.config as any
                    const outputMode = config.outputMode || 'article_and_x'
                    const sourceUrl = updatedClip.youtubeUrl

                    let xPostUrl: string | undefined
                    if (outputMode === 'article_and_x') {
                        xPostUrl = await generateAndPostThread(article.id, article.title, article.slug, sourceUrl, config.xThreadPrompt, clipUrl)
                    } else if (outputMode === 'article_and_x_post') {
                        xPostUrl = await generateAndPostSingle(article.id, article.title, article.slug, sourceUrl, config.xThreadPrompt, clipUrl)
                    }

                    if (xPostUrl) {
                        console.log(`[webhook/apify] ✓ Social post complete: ${xPostUrl}`)
                        await db.update(videoClips).set({ xPostId: xPostUrl, xPostedAt: new Date() }).where(eq(videoClips.id, clipId))
                    }
                }
            } catch (e: any) {
                console.error('[webhook/apify] Social posting failed:', e.message)
            }
        }

        return NextResponse.json({ success: true })
    } catch (e: any) {
        console.error('[webhook/apify] Error:', e.message)
        await db.update(videoClips).set({ status: 'failed', errorMessage: e.message }).where(eq(videoClips.id, clipId))
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
