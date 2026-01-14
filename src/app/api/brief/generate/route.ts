import { NextRequest, NextResponse } from 'next/server'
import { generateDailyBrief } from '@/lib/ai/discovery-worker'

export async function POST(request: NextRequest) {
    try {
        const brief = await generateDailyBrief()

        return NextResponse.json({
            success: true,
            brief,
        })
    } catch (error) {
        console.error('Brief generation failed:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to generate brief' },
            { status: 500 }
        )
    }
}
