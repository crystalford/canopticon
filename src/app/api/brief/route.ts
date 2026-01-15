import { NextResponse } from 'next/server'
import { getTodaysBrief } from '@/lib/ai/discovery-worker'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
    try {
        const brief = await getTodaysBrief()

        return NextResponse.json(
            { brief: brief || null },
            {
                headers: {
                    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
                }
            }
        )
    } catch (error) {
        console.error('Failed to fetch brief:', error)
        return NextResponse.json(
            { error: 'Failed to fetch brief' },
            { status: 500 }
        )
    }
}
