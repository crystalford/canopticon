import { NextResponse } from 'next/server'
import { db, videoClips } from '@/db'
import { eq } from 'drizzle-orm'
import { postToBluesky } from '@/lib/social/bluesky'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(
    _req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const [clip] = await db.select().from(videoClips).where(eq(videoClips.id, params.id)).limit(1)
        if (!clip) return NextResponse.json({ error: 'Clip not found' }, { status: 404 })
        if (!clip.clipUrl) return NextResponse.json({ error: 'Clip has no URL yet' }, { status: 400 })

        const text = clip.tweetDraft || (clip.keyQuote
            ? `"${clip.keyQuote}"\n\n— ${clip.channelName || clip.videoTitle || 'Source'}`
            : clip.videoTitle || 'New clip')

        const videoRes = await fetch(clip.clipUrl)
        if (!videoRes.ok) throw new Error(`Failed to fetch clip: ${videoRes.status}`)
        const videoBuffer = Buffer.from(await videoRes.arrayBuffer())
        console.log(`[post-bluesky] Clip: ${(videoBuffer.byteLength / 1024 / 1024).toFixed(1)}MB`)

        const uri = await postToBluesky({ text, videoBuffer })

        await db.update(videoClips)
            .set({ blueskyPostId: uri, blueskyPostedAt: new Date() })
            .where(eq(videoClips.id, params.id))

        return NextResponse.json({ success: true, uri })
    } catch (e: any) {
        console.error('[post-bluesky] Failed:', e.message)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
