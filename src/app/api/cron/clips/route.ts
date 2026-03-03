import { NextResponse } from 'next/server'
import { db, videoClips } from '@/db'
import { and, eq, isNull, lte, lt, gte } from 'drizzle-orm'
import { startApifyTranscript } from '@/lib/videos/pipeline'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Clips younger than this are not attempted yet — give YouTube time to generate captions
const MIN_AGE_MS = 20 * 60 * 1000       // 20 minutes

// Clips older than this are permanently marked failed — captions won't appear now
const MAX_AGE_MS = 5 * 60 * 60 * 1000  // 5 hours

export async function GET(req: Request) {
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = Date.now()
    const minAge = new Date(now - MIN_AGE_MS)   // older than 20 min — ready to try
    const maxAge = new Date(now - MAX_AGE_MS)   // older than 5h — give up

    // Mark permanently expired clips as failed
    const expiredResult = await db.update(videoClips)
        .set({ status: 'failed', errorMessage: 'Captions unavailable after 5 hours — likely disabled on this video' })
        .where(and(
            eq(videoClips.status, 'queued'),
            isNull(videoClips.startSeconds),
            lt(videoClips.createdAt, maxAge),
        ))
        .returning({ id: videoClips.id })

    if (expiredResult.length > 0) {
        console.log(`[cron/clips] Expired ${expiredResult.length} clips (>5h, no transcript)`)
    }

    // Find clips ready for their transcript attempt (20min–5h old, still queued, no clip window yet)
    const pending = await db.select({
        id: videoClips.id,
        youtubeUrl: videoClips.youtubeUrl,
        videoTitle: videoClips.videoTitle,
        createdAt: videoClips.createdAt,
    }).from(videoClips).where(and(
        eq(videoClips.status, 'queued'),
        isNull(videoClips.startSeconds),
        lte(videoClips.createdAt, minAge),
        gte(videoClips.createdAt, maxAge),
    )).limit(10)

    console.log(`[cron/clips] ${pending.length} clips pending transcript`)

    const results: { id: string; ok: boolean; error?: string }[] = []

    for (const clip of pending) {
        const ageMin = Math.floor((now - new Date(clip.createdAt).getTime()) / 60000)
        try {
            await startApifyTranscript(clip.id, clip.youtubeUrl)
            console.log(`[cron/clips] ✓ Started transcript for ${clip.id} (${ageMin}min old): ${clip.videoTitle}`)
            results.push({ id: clip.id, ok: true })
        } catch (e: any) {
            console.error(`[cron/clips] ✗ Failed to start transcript for ${clip.id}: ${e.message}`)
            results.push({ id: clip.id, ok: false, error: e.message })
        }
    }

    return NextResponse.json({
        processed: results.length,
        expired: expiredResult.length,
        results,
    })
}
