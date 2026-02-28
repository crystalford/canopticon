import { NextResponse } from 'next/server'
import { db, videoClips } from '@/db'
import { eq } from 'drizzle-orm'
import { postToBluesky } from '@/lib/social/bluesky'

export const dynamic = 'force-dynamic'

export async function POST(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const [clip] = await db.select().from(videoClips).where(eq(videoClips.id, params.id)).limit(1)
        if (!clip) return NextResponse.json({ error: 'Clip not found' }, { status: 404 })
        if (!clip.clipUrl) return NextResponse.json({ error: 'Clip has no URL yet' }, { status: 400 })

        const text = clip.keyQuote
            ? `"${clip.keyQuote}" — ${clip.videoTitle || ''}\n\n${clip.youtubeUrl}`
            : `${clip.clipRationale || clip.videoTitle || 'New clip'}\n\n${clip.youtubeUrl}`

        // Fetch video bytes for native upload
        let videoBuffer: Buffer | undefined
        try {
            const videoRes = await fetch(clip.clipUrl)
            if (videoRes.ok) videoBuffer = Buffer.from(await videoRes.arrayBuffer())
        } catch { /* fall through to text-only */ }

        const uri = await postToBluesky({ text, videoBuffer })

        await db.update(videoClips)
            .set({ blueskyPostId: uri, blueskyPostedAt: new Date() })
            .where(eq(videoClips.id, params.id))

        return NextResponse.json({ success: true, uri })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
