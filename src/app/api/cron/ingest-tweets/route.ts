import { ingestTweetsForMonitors } from '@/lib/x-ingestion'
import { NextResponse } from 'next/server'

// Verify cron secret to prevent unauthorized execution
export async function GET(req: Request) {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        // Allow running in development without secret if explicitly enabled or if no secret set (careful)
        if (process.env.NODE_ENV !== 'development' && process.env.CRON_SECRET) {
            return new NextResponse('Unauthorized', { status: 401 })
        }
    }

    try {
        const results = await ingestTweetsForMonitors(false) // force = false
        return NextResponse.json({ success: true, results })
    } catch (error) {
        console.error('Ingestion failed:', error)
        return NextResponse.json({ error: 'Ingestion failed' }, { status: 500 })
    }
}
