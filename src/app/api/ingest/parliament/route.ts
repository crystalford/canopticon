import { NextResponse } from 'next/server'
import { ensureParliamentSource, runParliamentWorker } from '@/lib/ingestion/parliament-worker'
import { processUnprocessedArticles } from '@/lib/signals/pipeline'

export const dynamic = 'force-dynamic'

/**
 * POST /api/ingest/parliament
 * Trigger the Parliament of Canada ingestion worker
 */
export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}))
        const limit = body.limit || 10

        // 1. Ensure source exists
        const sourceId = await ensureParliamentSource()

        // 2. Run worker
        const stats = await runParliamentWorker(sourceId, limit)

        // 3. Trigger signal pipeline for immediate feedback
        const pipelineStats = await processUnprocessedArticles()

        return NextResponse.json({
            success: true,
            stats,
            pipeline: pipelineStats
        })

    } catch (error) {
        console.error('Parliament ingestion error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
