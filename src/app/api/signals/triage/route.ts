import { NextResponse } from 'next/server'
import { processUnprocessedArticles } from '@/lib/signals'

/**
 * POST /api/signals/triage - Trigger signal pipeline processing
 */
export async function POST() {
    try {
        const result = await processUnprocessedArticles()

        return NextResponse.json({
            success: true,
            ...result,
        })
    } catch (error) {
        console.error('Error running triage:', error)
        return NextResponse.json(
            { error: 'Failed to run triage' },
            { status: 500 }
        )
    }
}
