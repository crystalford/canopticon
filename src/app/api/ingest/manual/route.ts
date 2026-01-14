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

        if (!url) {
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
            const [newSource] = await db.insert(sources).values({
                name: 'Manual Submission',
                protocol: 'manual',
                endpoint: 'manual',
                pollingInterval: 'manual',
                reliabilityWeight: 100, // Manual submissions are trusted
                isActive: true
            }).returning()
            manualSource = newSource
        }

        // 2. Submit the URL
        const result = await submitUrl(url, manualSource.id)

        if (!result.success) {
            return NextResponse.json(
                { error: result.reason || 'Failed to ingest URL' },
                { status: 500 }
            )
        }

        // 3. Trigger signal pipeline
        const pipelineStats = await processUnprocessedArticles()

        return NextResponse.json({
            success: true,
            articleId: result.articleId,
            pipeline: pipelineStats
        })

    } catch (error) {
        console.error('Manual ingestion error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
