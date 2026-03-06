import { NextResponse } from 'next/server'
import { db, videoClips } from '@/db'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: { id: string } }) {
    try {
        const [clip] = await db.select({ id: videoClips.id, status: videoClips.status })
            .from(videoClips)
            .where(eq(videoClips.id, params.id))
            .limit(1)

        if (!clip) return NextResponse.json({ error: 'Clip not found' }, { status: 404 })

        // Reset to queued so the hopper picks it up on next cron tick
        await db.update(videoClips)
            .set({
                status: 'queued',
                retryCount: 0,
                nextRetryAt: null,
                errorMessage: null,
                // Clear timestamps so cron treats it as a fresh transcript attempt
                startSeconds: null,
                endSeconds: null,
                clipRationale: null,
                keyQuote: null,
                extendedQuote: null,
                tweetDraft: null,
                speakerName: null,
            })
            .where(eq(videoClips.id, params.id))

        console.log(`[retry] Clip ${params.id} reset to queued`)
        return NextResponse.json({ success: true })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
