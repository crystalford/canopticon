import { NextResponse } from 'next/server'
import { db, videoClips } from '@/db'
import { eq } from 'drizzle-orm'
import { processVideoClip } from '@/lib/videos/processor'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // Allow up to 5 minutes on Vercel Pro (or 60s on Hobby)

export async function POST(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const [clip] = await db.select().from(videoClips).where(eq(videoClips.id, params.id))
        if (!clip) return NextResponse.json({ error: 'Clip not found' }, { status: 404 })

        if (clip.status === 'processing') {
            return NextResponse.json({ error: 'Already processing' }, { status: 400 })
        }

        // Set to processing immediately
        await db.update(videoClips)
            .set({ status: 'processing', errorMessage: null })
            .where(eq(videoClips.id, clip.id))

        // We run the processor synchronously so the UI can await the result.
        // For very long videos this might hit the 15s Vercel limit, but
        // since we're using yt-dlp --download-sections on the local server,
        // it should complete in 3-10 seconds.
        const result = await processVideoClip(clip.id, clip.youtubeUrl)

        return NextResponse.json(result)

    } catch (e: any) {
        console.error('[process API]', e)
        await db.update(videoClips)
            .set({ status: 'failed', errorMessage: e.message })
            .where(eq(videoClips.id, params.id))
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
