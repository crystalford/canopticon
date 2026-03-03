import { NextResponse } from 'next/server'
import { db, videoClips } from '@/db'
import { eq } from 'drizzle-orm'
import { onTranscriptReady } from '@/lib/videos/pipeline'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(req: Request) {
    const { searchParams } = new URL(req.url)
    const clipId = searchParams.get('clipId')
    if (!clipId) return NextResponse.json({ error: 'Missing clipId' }, { status: 400 })

    try {
        const payload = await req.json()
        const eventType = payload.eventType || ''
        const status = payload.resource?.status || payload.status || ''
        console.log(`[webhook/transcript] Clip ${clipId} — eventType: ${eventType}, status: ${status}`)

        const succeeded = eventType === 'ACTOR.RUN.SUCCEEDED' || status === 'SUCCEEDED'

        if (!succeeded) {
            // Apify actor itself failed — put back to queued so the cron retries
            console.log(`[webhook/transcript] Clip ${clipId} — actor failed, re-queuing for cron retry`)
            await db.update(videoClips)
                .set({ status: 'queued', errorMessage: 'Transcript attempt failed — will retry automatically' })
                .where(eq(videoClips.id, clipId))
            return NextResponse.json({ ok: true })
        }

        const datasetId = payload.resource?.defaultDatasetId
        if (!datasetId) throw new Error('No datasetId in transcript webhook payload')

        const token = process.env.APIFY_API_TOKEN

        // Apify may fire the webhook before dataset items are fully committed — retry if empty
        let items: any[] = []
        for (let attempt = 1; attempt <= 3; attempt++) {
            if (attempt > 1) {
                console.log(`[webhook/transcript] Dataset empty on attempt ${attempt - 1}, waiting 5s...`)
                await new Promise(r => setTimeout(r, 5000))
            }
            const res = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}`)
            if (!res.ok) throw new Error(`Failed to fetch transcript dataset: ${res.status}`)
            items = await res.json()
            if (items?.length && items[0]?.transcript?.length) break
        }

        // Still no transcript — captions not ready yet, put back to queued for cron retry
        if (!items?.length || !items[0]?.transcript?.length) {
            console.log(`[webhook/transcript] Clip ${clipId} — no transcript yet, re-queuing for cron retry`)
            await db.update(videoClips)
                .set({ status: 'queued', errorMessage: 'Captions not ready yet — will retry automatically' })
                .where(eq(videoClips.id, clipId))
            return NextResponse.json({ ok: true })
        }

        await onTranscriptReady(clipId, items)
        return NextResponse.json({ success: true })

    } catch (e: any) {
        console.error('[webhook/transcript] Error:', e.message)
        await db.update(videoClips)
            .set({ status: 'failed', errorMessage: e.message })
            .where(eq(videoClips.id, clipId))
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
