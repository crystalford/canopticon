import { NextResponse } from 'next/server'
import { ingestTweetsForMonitors } from '@/lib/x-ingestion'

export async function POST() {
    try {
        // In a real app, verify user session here (admin check)
        const results = await ingestTweetsForMonitors(true) // force = true
        return NextResponse.json({ success: true, results })
    } catch (error) {
        console.error('Manual check failed:', error)
        return NextResponse.json({ error: 'Check failed' }, { status: 500 })
    }
}
