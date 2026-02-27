import { NextResponse } from 'next/server'
import { db, videoClips } from '@/db'
import { eq } from 'drizzle-orm'
import { onClipReady } from '@/lib/videos/pipeline'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
    const { searchParams } = new URL(req.url)
    const clipId = searchParams.get('clipId')

    if (!clipId) {
        return NextResponse.json({ error: 'Missing clipId' }, { status: 400 })
    }

    try {
        const payload = await req.json()
        console.log(`[webhook/apify] Clip ${clipId} — status: ${payload.status}`)

        if (payload.status !== 'SUCCEEDED') {
            await db.update(videoClips)
                .set({ status: 'failed', errorMessage: `Apify run ${payload.status}` })
                .where(eq(videoClips.id, clipId))
            return NextResponse.json({ ok: true })
        }

        const datasetId = payload.resource?.defaultDatasetId
        if (!datasetId) {
            console.warn('[webhook/apify] No datasetId in payload')
            return NextResponse.json({ ok: true })
        }

        const apifyToken = process.env.APIFY_API_TOKEN
        const res = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyToken}`)
        if (!res.ok) throw new Error(`Failed to fetch dataset ${datasetId}`)

        const items = await res.json()
        const clipUrl = items?.[0]?.url
        if (!clipUrl) throw new Error('No clip URL found in dataset')

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
