import { NextResponse } from 'next/server'
import { ensureParliamentSource, runParliamentWorker } from '@/lib/ingestion/parliament-worker'

/**
 * POST /api/ingest/parliament
 * Trigger the Parliament of Canada ingestion worker
 */
export async function POST() {
    try {
        // 1. Ensure source exists
        const sourceId = await ensureParliamentSource()

        // 2. Run worker
        const stats = await runParliamentWorker(sourceId)

        return NextResponse.json({
            success: true,
            stats
        })

    } catch (error) {
        console.error('Parliament ingestion error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
