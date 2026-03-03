import { NextResponse } from 'next/server'
import { db, videoClips } from '@/db'
import { eq } from 'drizzle-orm'
import { onTranscriptReady } from '@/lib/videos/pipeline'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// If a clip is younger than this and captions fail, re-queue instead of failing.
const RETRY_WINDOW_MS = 3 * 60 * 60 * 1000 // 3 hours

async function retriggerTranscript(clipId: string, youtubeUrl: string, clipAgeMinutes: number): Promise<void> {
    const token = process.env.APIFY_API_TOKEN
    if (!token) throw new Error('APIFY_API_TOKEN not configured')
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${process.env.VERCEL_URL}` || 'http://localhost:3000'
    const webhookUrl = `${baseUrl}/api/webhooks/transcript?clipId=${clipId}`
    const webhooksParam = Buffer.from(JSON.stringify([{
        eventTypes: ['ACTOR.RUN.SUCCEEDED', 'ACTOR.RUN.FAILED'],
        requestUrl: webhookUrl,
    }])).toString('base64')
    const res = await fetch(
        `https://api.apify.com/v2/acts/leandrocb88~youtube-video-transcript-scraper/runs?token=${token}&webhooks=${encodeURIComponent(webhooksParam)}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ startUrls: [{ url: youtubeUrl }] }) }
    )
    if (!res.ok) throw new Error(`Apify retrigger failed: ${await res.text()}`)
    console.log(`[webhook/transcript] Clip ${clipId} re-queued (${clipAgeMinutes}min old — captions not ready yet)`)
    await db.update(videoClips)
        .set({ status: 'queued', errorMessage: `Captions not ready yet — retrying automatically (${clipAgeMinutes}min old)` })
        .where(eq(videoClips.id, clipId))
}

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
            // Apify actor itself failed — check clip age before giving up
            const [clip] = await db.select().from(videoClips).where(eq(videoClips.id, clipId)).limit(1)
            const clipAgeMs = clip ? Date.now() - new Date(clip.createdAt).getTime() : Infinity
            const clipAgeMinutes = Math.floor(clipAgeMs / 60000)
            if (clip && clipAgeMs < RETRY_WINDOW_MS) {
                await retriggerTranscript(clipId, clip.youtubeUrl, clipAgeMinutes)
                return NextResponse.json({ ok: true, retrying: true })
            }
            await db.update(videoClips)
                .set({ status: 'failed', errorMessage: `Transcript run failed (${eventType || status})` })
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

        // Still no transcript after retries — check clip age
        if (!items?.length || !items[0]?.transcript?.length) {
            const [clip] = await db.select().from(videoClips).where(eq(videoClips.id, clipId)).limit(1)
            const clipAgeMs = clip ? Date.now() - new Date(clip.createdAt).getTime() : Infinity
            const clipAgeMinutes = Math.floor(clipAgeMs / 60000)
            if (clip && clipAgeMs < RETRY_WINDOW_MS) {
                await retriggerTranscript(clipId, clip.youtubeUrl, clipAgeMinutes)
                return NextResponse.json({ ok: true, retrying: true })
            }
            throw new Error('No transcript returned — captions may be disabled on this video')
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
