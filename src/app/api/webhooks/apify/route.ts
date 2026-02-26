import { NextResponse } from 'next/server'
import { db, videoClips, articles, automations } from '@/db'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

// Webhook called by Apify when a clip finishes (SUCCEEDED or FAILED)
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
        console.log(`[webhook/apify] Callback for clip ${clipId}. Status: ${payload.status}`)

        const datasetId = payload.resource?.defaultDatasetId
        if (!datasetId) {
            console.warn('[webhook/apify] No datasetId in payload')
            return NextResponse.json({ ok: true })
        }

        // Fetch dataset from Apify to get the clip URL
        const apifyToken = process.env.APIFY_API_TOKEN
        const res = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyToken}`)
        if (!res.ok) throw new Error(`Failed to fetch dataset ${datasetId}`)

        const items = await res.json()
        const clipUrl = items && items.length > 0 ? items[0].url : null

        if (!clipUrl) throw new Error('No clip URL found in dataset')

        // Save clip to DB
        const [updatedClip] = await db.update(videoClips)
            .set({ status: 'done', clipUrl, processedAt: new Date() })
            .where(eq(videoClips.id, clipId))
            .returning()

        console.log(`[webhook/apify] Clip ${clipId} ready: ${clipUrl}`)

        // Post to X if automation info is provided
        if (automationId && updatedClip) {
            try {
                const automation = await db.query.automations.findFirst({ where: eq(automations.id, automationId) })
                if (!automation) throw new Error('Automation not found')

                const { getOutputFlags, postToX } = await import('@/lib/automations/runner')
                const config = automation.config as Record<string, any>
                const flags = getOutputFlags(config)

                if (!flags.postX) {
                    console.log('[webhook/apify] postX is disabled, skipping X post')
                    return NextResponse.json({ success: true })
                }

                // Determine content and link
                let content: string
                let title: string
                let linkUrl: string | undefined

                const sourceUrl = updatedClip.youtubeUrl

                if (articleId) {
                    const article = await db.query.articles.findFirst({ where: eq(articles.id, articleId) })
                    if (!article) throw new Error('Article not found')
                    content = article.content
                    title = article.title
                    linkUrl = flags.includeArticleLink
                        ? `https://canopticon.com/articles/${article.slug}`
                        : sourceUrl
                } else {
                    // No article — use video title, link to YouTube
                    content = `Video: ${updatedClip.videoTitle || 'New Video'}\nURL: ${sourceUrl}`
                    title = updatedClip.videoTitle || 'New Video'
                    linkUrl = sourceUrl
                }

                const xPostUrl = await postToX({
                    content,
                    title,
                    linkUrl,
                    xFormat: flags.xFormat,
                    xTweetCount: flags.xTweetCount,
                    xThreadPrompt: config.xThreadPrompt,
                    videoClipUrl: clipUrl,
                    videoSourceUrl: sourceUrl,
                })

                console.log(`[webhook/apify] X post complete: ${xPostUrl}`)
                await db.update(videoClips)
                    .set({ xPostId: xPostUrl, xPostedAt: new Date() })
                    .where(eq(videoClips.id, clipId))

            } catch (e: any) {
                console.error('[webhook/apify] X post failed:', e.message)
            }
        }

        return NextResponse.json({ success: true })
    } catch (e: any) {
        console.error('[webhook/apify] Error:', e.message)
        await db.update(videoClips)
            .set({ status: 'failed', errorMessage: e.message })
            .where(eq(videoClips.id, clipId))
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
