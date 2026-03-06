import { NextResponse } from 'next/server'
import { db, videoClips } from '@/db'
import { and, eq, isNull, isNotNull, lte, lt, or, gte } from 'drizzle-orm'
import { processQueuedClip, triggerApify } from '@/lib/videos/pipeline'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// How long before the first transcript attempt (give YouTube time to process captions)
const FIRST_ATTEMPT_DELAY_MS = 20 * 60 * 1000  // 20 min

// Retry delays for transcript failures (exponential-ish backoff)
const TRANSCRIPT_RETRY_DELAYS_MS = [
    40 * 60 * 1000,   // retry 1 → try again in 40 min
    60 * 60 * 1000,   // retry 2 → try again in 60 min
    90 * 60 * 1000,   // retry 3 → try again in 90 min
    120 * 60 * 1000,  // retry 4 → try again in 2h
]
const MAX_RETRIES = TRANSCRIPT_RETRY_DELAYS_MS.length + 1  // 5 total attempts

// Retry delays for clipper failures (shorter — Apify is often flaky then fine)
const CLIPPER_RETRY_DELAYS_MS = [
    10 * 60 * 1000,  // retry 1 → 10 min
    20 * 60 * 1000,  // retry 2 → 20 min
    40 * 60 * 1000,  // retry 3 → 40 min
    60 * 60 * 1000,  // retry 4 → 60 min
]
const MAX_CLIPPER_RETRIES = CLIPPER_RETRY_DELAYS_MS.length + 1 // 5 total attempts

export async function GET(req: Request) {
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const firstAttemptCutoff = new Date(Date.now() - FIRST_ATTEMPT_DELAY_MS)

    // ── Phase 1: Permanently fail transcript-exhausted clips ──────────────────
    const transcriptExhausted = await db.update(videoClips)
        .set({ status: 'failed', errorMessage: 'No captions available after all retry attempts (5 tries over ~5 hours)' })
        .where(and(
            eq(videoClips.status, 'queued'),
            isNull(videoClips.startSeconds),   // transcript never succeeded
            gte(videoClips.retryCount, MAX_RETRIES),
        ))
        .returning({ id: videoClips.id })

    if (transcriptExhausted.length > 0) {
        console.log(`[cron/clips] Permanently failed ${transcriptExhausted.length} transcript-exhausted clips`)
    }

    // ── Phase 2: Permanently fail clipper-exhausted clips ────────────────────
    const clipperExhausted = await db.update(videoClips)
        .set({ status: 'failed', errorMessage: 'Video clipper failed after all retry attempts (5 tries)' })
        .where(and(
            eq(videoClips.status, 'queued'),
            isNotNull(videoClips.startSeconds), // transcript succeeded
            isNull(videoClips.clipUrl),         // but clip never produced
            gte(videoClips.retryCount, MAX_CLIPPER_RETRIES),
        ))
        .returning({ id: videoClips.id })

    if (clipperExhausted.length > 0) {
        console.log(`[cron/clips] Permanently failed ${clipperExhausted.length} clipper-exhausted clips`)
    }

    // ── Phase 3: Find transcript-stage clips ready for processing ─────────────
    // Clips where transcript hasn't been fetched yet:
    //   - Never tried: created at least 20min ago + nextRetryAt IS NULL
    //   - Retrying: nextRetryAt <= now
    const transcriptPending = await db.select({
        id: videoClips.id,
        youtubeUrl: videoClips.youtubeUrl,
        videoTitle: videoClips.videoTitle,
        retryCount: videoClips.retryCount,
        createdAt: videoClips.createdAt,
    }).from(videoClips).where(and(
        eq(videoClips.status, 'queued'),
        isNull(videoClips.startSeconds),          // transcript not done
        lt(videoClips.retryCount, MAX_RETRIES),
        or(
            and(isNull(videoClips.nextRetryAt), lte(videoClips.createdAt, firstAttemptCutoff)),
            and(isNotNull(videoClips.nextRetryAt), lte(videoClips.nextRetryAt, now)),
        ),
    )).limit(3)

    // ── Phase 4: Find clipper-stage clips ready for retry ────────────────────
    // Clips where transcript succeeded but Apify clipper failed and is due for retry
    const clipperPending = await db.select({
        id: videoClips.id,
        youtubeUrl: videoClips.youtubeUrl,
        videoTitle: videoClips.videoTitle,
        startSeconds: videoClips.startSeconds,
        endSeconds: videoClips.endSeconds,
        automationId: videoClips.automationId,
        retryCount: videoClips.retryCount,
    }).from(videoClips).where(and(
        eq(videoClips.status, 'queued'),
        isNotNull(videoClips.startSeconds),       // transcript done, AI picked window
        isNull(videoClips.clipUrl),               // but no clip produced yet
        lt(videoClips.retryCount, MAX_CLIPPER_RETRIES),
        isNotNull(videoClips.nextRetryAt),
        lte(videoClips.nextRetryAt, now),
    )).limit(3)

    console.log(`[cron/clips] ${transcriptPending.length} transcript clips + ${clipperPending.length} clipper retries ready`)

    const results: { id: string; stage: string; ok: boolean; retryCount: number; nextRetryAt?: string; error?: string }[] = []

    // ── Process transcript-stage clips ───────────────────────────────────────
    for (const clip of transcriptPending) {
        const attempt = clip.retryCount + 1
        const ageMin = Math.floor((now.getTime() - new Date(clip.createdAt).getTime()) / 60000)
        console.log(`[cron/clips] Transcript attempt ${attempt}/${MAX_RETRIES} for clip ${clip.id} (${ageMin}min old): ${clip.videoTitle || clip.youtubeUrl}`)

        try {
            await processQueuedClip(clip.id, clip.youtubeUrl, clip.videoTitle)
            console.log(`[cron/clips] ✓ Clip ${clip.id} transcript+AI done`)
            results.push({ id: clip.id, stage: 'transcript', ok: true, retryCount: attempt })
        } catch (e: any) {
            const newRetryCount = attempt
            const nextDelay = TRANSCRIPT_RETRY_DELAYS_MS[newRetryCount - 1]
            const nextRetryAt = nextDelay ? new Date(Date.now() + nextDelay) : null

            await db.update(videoClips)
                .set({
                    retryCount: newRetryCount,
                    nextRetryAt,
                    errorMessage: `Attempt ${attempt}: ${e.message}`,
                    ...(newRetryCount >= MAX_RETRIES
                        ? { status: 'failed', errorMessage: `Failed after ${MAX_RETRIES} attempts. Last error: ${e.message}` }
                        : {}),
                })
                .where(eq(videoClips.id, clip.id))

            console.error(`[cron/clips] ✗ Clip ${clip.id} transcript attempt ${attempt} failed: ${e.message}${nextRetryAt ? ` — next retry at ${nextRetryAt.toISOString()}` : ' — giving up'}`)
            results.push({
                id: clip.id,
                stage: 'transcript',
                ok: false,
                retryCount: newRetryCount,
                nextRetryAt: nextRetryAt?.toISOString(),
                error: e.message,
            })
        }
    }

    // ── Process clipper-stage retries ─────────────────────────────────────────
    for (const clip of clipperPending) {
        const attempt = clip.retryCount + 1
        console.log(`[cron/clips] Clipper retry ${attempt}/${MAX_CLIPPER_RETRIES} for clip ${clip.id}: ${clip.videoTitle || clip.youtubeUrl}`)

        try {
            await db.update(videoClips)
                .set({ status: 'processing', errorMessage: null, nextRetryAt: null })
                .where(eq(videoClips.id, clip.id))

            await triggerApify(clip.id, clip.youtubeUrl, clip.startSeconds!, clip.endSeconds!, clip.automationId ?? undefined)
            console.log(`[cron/clips] ✓ Clipper re-triggered for clip ${clip.id}`)
            results.push({ id: clip.id, stage: 'clipper', ok: true, retryCount: attempt })
        } catch (e: any) {
            const newRetryCount = attempt
            const nextDelay = CLIPPER_RETRY_DELAYS_MS[newRetryCount - 1]
            const nextRetryAt = nextDelay ? new Date(Date.now() + nextDelay) : null

            await db.update(videoClips)
                .set({
                    status: 'queued',
                    retryCount: newRetryCount,
                    nextRetryAt,
                    errorMessage: `Clipper attempt ${attempt}: ${e.message}`,
                    ...(newRetryCount >= MAX_CLIPPER_RETRIES
                        ? { status: 'failed', errorMessage: `Clipper failed after ${MAX_CLIPPER_RETRIES} attempts. Last error: ${e.message}` }
                        : {}),
                })
                .where(eq(videoClips.id, clip.id))

            console.error(`[cron/clips] ✗ Clipper retry ${attempt} failed for clip ${clip.id}: ${e.message}`)
            results.push({
                id: clip.id,
                stage: 'clipper',
                ok: false,
                retryCount: newRetryCount,
                nextRetryAt: nextRetryAt?.toISOString(),
                error: e.message,
            })
        }
    }

    return NextResponse.json({
        processed: results.length,
        transcriptExhausted: transcriptExhausted.length,
        clipperExhausted: clipperExhausted.length,
        results,
    })
}
