import { NextResponse } from 'next/server'
import { db, videoClips } from '@/db'
import { eq } from 'drizzle-orm'
import { onClipReady } from '@/lib/videos/pipeline'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: Request) {
    const { searchParams } = new URL(req.url)
    const clipId = searchParams.get('clipId')

    if (!clipId) {
        return NextResponse.json({ error: 'Missing clipId' }, { status: 400 })
    }

    try {
        const payload = await req.json()
        // Apify platform webhook: { eventType, resource: { status, defaultDatasetId } }
        const eventType = payload.eventType || ''
        const status = payload.resource?.status || payload.status || ''
        console.log(`[webhook/apify] Clip ${clipId} — eventType: ${eventType}, status: ${status}`)

        const succeeded = eventType === 'ACTOR.RUN.SUCCEEDED' || status === 'SUCCEEDED'
        if (!succeeded) {
            await db.update(videoClips)
                .set({ status: 'failed', errorMessage: `Clipper run failed (${eventType || status})` })
                .where(eq(videoClips.id, clipId))
            return NextResponse.json({ ok: true })
        }

        const datasetId = payload.resource?.defaultDatasetId
        if (!datasetId) {
            throw new Error('No datasetId in clipper webhook payload')
        }

        const apifyToken = process.env.APIFY_API_TOKEN
        const res = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyToken}`)
        if (!res.ok) throw new Error(`Failed to fetch dataset ${datasetId}: ${res.status}`)

        const items = await res.json()
        const clipUrl = items?.[0]?.url
        if (!clipUrl) throw new Error(`No clip URL in dataset. Items: ${JSON.stringify(items).slice(0, 200)}`)

        await onClipReady(clipId, clipUrl)
        return NextResponse.json({ success: true })

    } catch (e: any) {
        console.error('[webhook/apify] Error:', e.message)
        await db.update(videoClips)
            .set({ status: 'failed', errorMessage: e.message })
            .where(eq(videoClips.id, clipId))
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
