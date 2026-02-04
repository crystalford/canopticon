import { NextRequest, NextResponse } from 'next/server'
import { db, sources } from '@/db'
import { eq } from 'drizzle-orm'
import { submitUrl } from '@/lib/ingestion/manual-worker'
import { processUnprocessedArticles } from '@/lib/signals/pipeline'

export const dynamic = 'force-dynamic'

/**
 * POST /api/ingest/manual
 * Manually submit a URL for ingestion
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { url } = body

        console.log('[v0] Manual ingestion request:', url)

        if (!url) {
            console.error('[v0] No URL provided')
            return NextResponse.json(
                { error: 'URL is required' },
                { status: 400 }
            )
        }

        // 1. Get or create the "Manual Submission" source
        let manualSource = await db.query.sources.findFirst({
            where: eq(sources.protocol, 'manual')
        })

        if (!manualSource) {
            console.log('[v0] Creating manual submission source...')
            const [newSource] = await db.insert(sources).values({
                name: 'Manual Submission',
                protocol: 'manual',
                endpoint: 'manual',
                pollingInterval: 'manual',
                reliabilityWeight: 100, // Manual submissions are trusted
                isActive: true
            }).returning()
            manualSource = newSource
            console.log('[v0] Created source:', manualSource.id)
        }

        // 2. Submit the URL
        console.log('[v0] Submitting URL to manual worker...')
        const result = await submitUrl(url, manualSource.id)

        if (!result.success) {
            console.error('[v0] Manual worker failed:', result.reason)
            return NextResponse.json(
                { error: result.reason || 'Failed to ingest URL' },
                { status: 500 }
            )
        }

        console.log('[v0] URL ingested successfully:', result.articleId)

        // 3. Trigger signal pipeline
        console.log('[v0] Triggering signal pipeline...')
        const pipelineStats = await processUnprocessedArticles()
        console.log('[v0] Pipeline stats:', pipelineStats)

        return NextResponse.json({
            success: true,
            articleId: result.articleId,
            pipeline: pipelineStats
        })

    } catch (error) {
        console.error('[v0] Manual ingestion error:', error)
        const message = error instanceof Error ? error.message : 'Internal server error'
        return NextResponse.json(
            { error: message },
            { status: 500 }
        )
    }
}
