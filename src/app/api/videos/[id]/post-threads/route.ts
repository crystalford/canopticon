import { NextResponse } from 'next/server'
import { db, videoClips } from '@/db'
import { eq } from 'drizzle-orm'
import { postToThreads } from '@/lib/social/threads'

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

        const threadsId = await postToThreads({ text })

        await db.update(videoClips)
            .set({ threadsPostId: threadsId, threadsPostedAt: new Date() })
            .where(eq(videoClips.id, params.id))

        return NextResponse.json({ success: true, threadsId })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
