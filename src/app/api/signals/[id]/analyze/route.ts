import { NextRequest, NextResponse } from 'next/server'
import { runSignalAnalysis } from '@/lib/signals/pipeline'

export const dynamic = 'force-dynamic'

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const result = await runSignalAnalysis(params.id)

        if (!result.success) {
            return NextResponse.json(
                { error: result.reason || 'Analysis failed' },
                { status: 500 }
            )
        }

        return NextResponse.json({ success: true })

    } catch (error) {
        console.error('Analysis error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
