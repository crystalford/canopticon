import { NextResponse } from 'next/server'
import { getTodaysBrief } from '@/lib/ai/discovery-worker'

export async function GET() {
    try {
        const brief = await getTodaysBrief()

        return NextResponse.json({
            brief: brief || null,
        })
    } catch (error) {
        console.error('Failed to fetch brief:', error)
        return NextResponse.json(
            { error: 'Failed to fetch brief' },
            { status: 500 }
        )
    }
}
