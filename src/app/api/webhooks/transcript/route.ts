import { NextResponse } from 'next/server'
import { db, videoClips } from '@/db'
import { eq } from 'drizzle-orm'
import { onTranscriptReady } from '@/lib/videos/pipeline'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: Request) {
    const { searchParams } = new URL(req.url)
    const clipId = searchParams.get('clipId')
    if (!clipId) return NextResponse.json({ error: 'Missing clipId' }, { status: 400 })

    try {
        const payload = await req.json()
        console.log(`[webhook/transcript] Clip ${clipId} — status: ${payload.status}`)

        if (payload.status !== 'SUCCEEDED') {
            await db.update(videoClips)
                .set({ status: 'failed', errorMessage: `Transcript run ${payload.status}` })
                .where(eq(videoClips.id, clipId))
            return NextResponse.json({ ok: true })
        }

        const datasetId = payload.resource?.defaultDatasetId
        if (!datasetId) throw new Error('No datasetId in transcript webhook payload')

        const token = process.env.APIFY_API_TOKEN
        const res = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}`)
        if (!res.ok) throw new Error(`Failed to fetch transcript dataset: ${res.status}`)

        const items = await res.json()
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
