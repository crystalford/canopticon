import { NextResponse } from 'next/server'
import { db, videoClips } from '@/db'
import { and, eq, isNull, isNotNull, lte, lt, or, gte } from 'drizzle-orm'
import { processQueuedClip } from '@/lib/videos/pipeline'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// How long before the first attempt (give YouTube time to process captions)
const FIRST_ATTEMPT_DELAY_MS = 20 * 60 * 1000  // 20 min

// Retry delays after each failure (exponential-ish backoff)
const RETRY_DELAYS_MS = [
    40 * 60 * 1000,   // retry 1 → try again in 40 min
    60 * 60 * 1000,   // retry 2 → try again in 60 min
    90 * 60 * 1000,   // retry 3 → try again in 90 min
    120 * 60 * 1000,  // retry 4 → try again in 2h
]

const MAX_RETRIES = RETRY_DELAYS_MS.length + 1  // 5 total attempts

export async function GET(req: Request) {
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const firstAttemptCutoff = new Date(Date.now() - FIRST_ATTEMPT_DELAY_MS)

    // Mark clips that have exhausted all retries as permanently failed
    const exhausted = await db.update(videoClips)
        .set({ status: 'failed', errorMessage: 'No captions available after all retry attempts (5 tries over ~5 hours)' })
        .where(and(
            eq(videoClips.status, 'queued'),
            isNull(videoClips.startSeconds),
            gte(videoClips.retryCount, MAX_RETRIES),
        ))
        .returning({ id: videoClips.id })

    if (exhausted.length > 0) {
        console.log(`[cron/clips] Permanently failed ${exhausted.length} exhausted clips`)
    }

    // Find clips ready for their next attempt:
    //   - Never tried: queued + no startSeconds + created at least 20min ago + nextRetryAt IS NULL
    //   - Retrying: queued + no startSeconds + nextRetryAt <= now
    const pending = await db.select({
        id: videoClips.id,
        youtubeUrl: videoClips.youtubeUrl,
        videoTitle: videoClips.videoTitle,
        retryCount: videoClips.retryCount,
        createdAt: videoClips.createdAt,
    }).from(videoClips).where(and(
        eq(videoClips.status, 'queued'),
        isNull(videoClips.startSeconds),
        lt(videoClips.retryCount, MAX_RETRIES),
        or(
            and(isNull(videoClips.nextRetryAt), lte(videoClips.createdAt, firstAttemptCutoff)),
            and(isNotNull(videoClips.nextRetryAt), lte(videoClips.nextRetryAt, now)),
        ),
    )).limit(3)

    console.log(`[cron/clips] ${pending.length} clips ready for processing`)

    const results: { id: string; ok: boolean; retryCount: number; nextRetryAt?: string; error?: string }[] = []

    for (const clip of pending) {
        const attempt = clip.retryCount + 1
        const ageMin = Math.floor((now.getTime() - new Date(clip.createdAt).getTime()) / 60000)
        console.log(`[cron/clips] Attempt ${attempt}/${MAX_RETRIES} for clip ${clip.id} (${ageMin}min old): ${clip.videoTitle || clip.youtubeUrl}`)

        try {
            await processQueuedClip(clip.id, clip.youtubeUrl, clip.videoTitle)
            console.log(`[cron/clips] ✓ Clip ${clip.id} processed successfully`)
            results.push({ id: clip.id, ok: true, retryCount: attempt })
        } catch (e: any) {
            const newRetryCount = attempt
            const nextDelay = RETRY_DELAYS_MS[newRetryCount - 1]  // undefined if exhausted
            const nextRetryAt = nextDelay ? new Date(Date.now() + nextDelay) : null

            await db.update(videoClips)
                .set({
                    retryCount: newRetryCount,
                    nextRetryAt,
                    errorMessage: `Attempt ${attempt}: ${e.message}`,
                    // If no more retries, mark failed immediately
                    ...(newRetryCount >= MAX_RETRIES
                        ? { status: 'failed', errorMessage: `Failed after ${MAX_RETRIES} attempts. Last error: ${e.message}` }
                        : {}),
                })
                .where(eq(videoClips.id, clip.id))

            console.error(`[cron/clips] ✗ Clip ${clip.id} attempt ${attempt} failed: ${e.message}${nextRetryAt ? ` — next retry at ${nextRetryAt.toISOString()}` : ' — giving up'}`)
            results.push({
                id: clip.id,
                ok: false,
                retryCount: newRetryCount,
                nextRetryAt: nextRetryAt?.toISOString(),
                error: e.message,
            })
        }
    }

    return NextResponse.json({
        processed: results.length,
        exhausted: exhausted.length,
        results,
    })
}
