import { NextResponse } from 'next/server'
import { db, videoClips } from '@/db'
import { eq } from 'drizzle-orm'
import { postToX } from '@/lib/automations/runner'

export const dynamic = 'force-dynamic'

export async function POST(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const [clip] = await db.select().from(videoClips).where(eq(videoClips.id, params.id)).limit(1)
        if (!clip) return NextResponse.json({ error: 'Clip not found' }, { status: 404 })
        if (!clip.clipUrl) return NextResponse.json({ error: 'Clip has no URL yet' }, { status: 400 })

        const result = await postToX({
            content: clip.clipRationale || clip.videoTitle || 'New clip',
            title: clip.videoTitle || 'New clip',
            xFormat: 'post',
            xTweetCount: 1,
            videoClipUrl: clip.clipUrl,
            videoSourceUrl: clip.youtubeUrl,
        })

        await db.update(videoClips)
            .set({ xPostedAt: new Date(), xPostId: result || null })
            .where(eq(videoClips.id, params.id))

        return NextResponse.json({ success: true })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
