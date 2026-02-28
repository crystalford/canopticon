import { NextResponse } from 'next/server'
import { db, videoClips } from '@/db'
import { eq } from 'drizzle-orm'
import { postToTiktok } from '@/lib/social/tiktok'

export const dynamic = 'force-dynamic'

export async function POST(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const [clip] = await db.select().from(videoClips).where(eq(videoClips.id, params.id)).limit(1)
        if (!clip) return NextResponse.json({ error: 'Clip not found' }, { status: 404 })
        if (!clip.clipUrl) return NextResponse.json({ error: 'Clip has no URL yet' }, { status: 400 })

        const videoRes = await fetch(clip.clipUrl)
        if (!videoRes.ok) throw new Error(`Failed to fetch clip: ${videoRes.status}`)
        const videoBuffer = Buffer.from(await videoRes.arrayBuffer())

        const tiktokId = await postToTiktok({
            title: clip.videoTitle || clip.clipRationale || 'New clip',
            videoBuffer,
        })

        await db.update(videoClips)
            .set({ tiktokPostId: tiktokId, tiktokPostedAt: new Date() })
            .where(eq(videoClips.id, params.id))

        return NextResponse.json({ success: true, tiktokId })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
