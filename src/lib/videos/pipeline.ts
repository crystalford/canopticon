import { generateText } from 'ai'
import { getModel } from '@/lib/ai/providers'
import { db, videoClips, automations } from '@/db'
import { articles } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { put } from '@vercel/blob'
import { postToX } from '@/lib/automations/runner'
import RSSParser from 'rss-parser'
import type { Automation } from '@/db/schema'

const parser = new RSSParser()

// ── Helpers ───────────────────────────────────────────────────────────────────

const toHHMMSS = (secs: number) => {
    const h = Math.floor(secs / 3600).toString().padStart(2, '0')
    const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0')
    const s = (secs % 60).toString().padStart(2, '0')
    return `${h}:${m}:${s}`
}

async function selectClipWindow(
    url: string,
    title: string,
    transcript: string
): Promise<{ start: number; end: number; rationale: string; keyQuote: string }> {
    const model = await getModel('anthropic', 'claude-sonnet-4-20250514')
    const prompt = `You are a viral political media editor. Find the SINGLE most compelling 60-120 second window from this video for social media.

WHAT MAKES A GREAT CLIP:
- A politician making a specific, quotable claim, admission, or attack
- A heated exchange where someone is cornered or contradicted
- A shocking statistic or revelation stated plainly
- A moment of visible frustration, passion, or contradiction
- Complete thought arc: setup → point → conclusion (no dangling mid-sentence)

RULES:
- Skip intros, B-roll, music, applause. Start at the first substantive word.
- The clip must be 60-120 seconds. Do not go under 60s.
- End on a natural sentence break — never cut mid-sentence.
- key_quote: the single most quotable sentence or phrase from within the clip window. Exact words only, no paraphrase.

Video: "${title}"
URL: ${url}

Timestamped transcript:
${transcript}

Return ONLY valid JSON, no markdown:
{"start_seconds": <number>, "end_seconds": <number>, "rationale": "<one sentence why this is the best hook>", "key_quote": "<exact verbatim quote from the clip>"}`

    const result = await generateText({ model, prompt })
    const match = result.text.match(/\{[\s\S]*?\}/)
    if (!match) throw new Error('AI failed to return clip timestamps')
    const parsed = JSON.parse(match[0])
    if (typeof parsed.start_seconds !== 'number' || typeof parsed.end_seconds !== 'number') {
        throw new Error('AI returned invalid timestamp format')
    }
    return {
        start: parsed.start_seconds,
        end: parsed.end_seconds,
        rationale: parsed.rationale || '',
        keyQuote: parsed.key_quote || '',
    }
}

async function triggerApify(
    clipId: string,
    youtubeUrl: string,
    start: number,
    end: number,
    automationId?: string
): Promise<void> {
    const token = process.env.APIFY_API_TOKEN
    if (!token) throw new Error('APIFY_API_TOKEN not configured')

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${process.env.VERCEL_URL}` || 'http://localhost:3000'
    const webhookUrl = `${baseUrl}/api/webhooks/apify?clipId=${clipId}${automationId ? `&automationId=${automationId}` : ''}`

    // Platform-level webhook via base64 URL param (same pattern as transcript actor)
    const webhooksParam = Buffer.from(JSON.stringify([{
        eventTypes: ['ACTOR.RUN.SUCCEEDED', 'ACTOR.RUN.FAILED'],
        requestUrl: webhookUrl,
    }])).toString('base64')

    const res = await fetch(
        `https://api.apify.com/v2/acts/fractalai~youtube-video-clipper/runs?token=${token}&webhooks=${encodeURIComponent(webhooksParam)}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                videoUrl: youtubeUrl,
                clips: [{ start: toHHMMSS(start), end: toHHMMSS(end), name: 'Canopticon-Clip' }],
                quality: '720p',
            }),
        }
    )
    if (!res.ok) throw new Error(`Apify clipper failed: ${await res.text()}`)
    const data = await res.json()
    console.log(`[triggerApify] ✓ Queued run ${data.data?.id}`)
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Queue a video for AI clipping.
 * Creates a DB record, then starts an Apify transcript actor ASYNC.
 * The transcript webhook (/api/webhooks/transcript) handles the rest.
 */
export async function queueVideoClip(
    youtubeUrl: string,
    videoTitle?: string,
    automationId?: string
): Promise<string> {
    const [clip] = await db.insert(videoClips).values({
        youtubeUrl,
        videoTitle: videoTitle && videoTitle !== 'Loading...' ? videoTitle : null,
        status: 'queued',
        automationId: automationId ?? null,
    }).returning({ id: videoClips.id })

    console.log(`[queueVideoClip] Created clip ${clip.id}`)

    const token = process.env.APIFY_API_TOKEN
    if (!token) {
        await db.update(videoClips)
            .set({ status: 'failed', errorMessage: 'APIFY_API_TOKEN not configured' })
            .where(eq(videoClips.id, clip.id))
        return clip.id
    }

    try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${process.env.VERCEL_URL}` || 'http://localhost:3000'
        const webhookUrl = `${baseUrl}/api/webhooks/transcript?clipId=${clip.id}`

        // Platform-level webhook must be passed as a base64 URL param, NOT in the body
        // (body goes to the actor as input — the transcript actor doesn't process a webhooks field)
        const webhooksParam = Buffer.from(JSON.stringify([{
            eventTypes: ['ACTOR.RUN.SUCCEEDED', 'ACTOR.RUN.FAILED'],
            requestUrl: webhookUrl,
        }])).toString('base64')

        const res = await fetch(
            `https://api.apify.com/v2/acts/leandrocb88~youtube-video-transcript-scraper/runs?token=${token}&webhooks=${encodeURIComponent(webhooksParam)}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ startUrls: [{ url: youtubeUrl }] }),
            }
        )
        if (!res.ok) throw new Error(`Apify transcript start failed: ${await res.text()}`)
        const run = await res.json()
        console.log(`[queueVideoClip] ✓ Transcript run ${run.data?.id} started`)
    } catch (e: any) {
        console.error(`[queueVideoClip] Failed to start transcript for ${clip.id}:`, e.message)
        await db.update(videoClips)
            .set({ status: 'failed', errorMessage: e.message })
            .where(eq(videoClips.id, clip.id))
    }

    return clip.id
}

/**
 * Called by /api/webhooks/transcript when Apify transcript run completes.
 * Parses transcript, runs Claude to pick clip window, triggers video clipper.
 */
export async function onTranscriptReady(clipId: string, transcriptItems: any[]): Promise<void> {
    try {
        const [clip] = await db.select().from(videoClips).where(eq(videoClips.id, clipId)).limit(1)
        if (!clip) throw new Error('Clip record not found')

        if (!transcriptItems || transcriptItems.length === 0 || !transcriptItems[0].transcript) {
            throw new Error('No transcript returned — captions may be disabled on this video')
        }

        const segments = transcriptItems[0].transcript as Array<{ start: number; text: string }>
        const formatTime = (s: number) => {
            const m = Math.floor(s / 60)
            const sec = Math.floor(s % 60)
            return `[${m}:${sec.toString().padStart(2, '0')}]`
        }
        const transcript = segments.map(s => `${formatTime(s.start)} ${s.text.trim()}`).join('\n')

        // Claude picks best clip window
        const { start, end, rationale, keyQuote } = await selectClipWindow(clip.youtubeUrl, clip.videoTitle || '', transcript)
        console.log(`[onTranscriptReady] AI selected ${start}s→${end}s: ${rationale}`)

        await db.update(videoClips)
            .set({ startSeconds: start, endSeconds: end, clipRationale: rationale, keyQuote, status: 'processing' })
            .where(eq(videoClips.id, clipId))

        await triggerApify(clipId, clip.youtubeUrl, start, end, clip.automationId ?? undefined)

    } catch (e: any) {
        console.error(`[onTranscriptReady] Failed for ${clipId}:`, e.message)
        await db.update(videoClips)
            .set({ status: 'failed', errorMessage: e.message })
            .where(eq(videoClips.id, clipId))
    }
}

/**
 * Generate a short site article/post from a clip.
 * Returns the article id on success.
 */
async function generateClipArticle(clip: {
    id: string
    videoTitle: string | null
    youtubeUrl: string
    channelName: string | null
    keyQuote: string | null
    clipRationale: string | null
    clipUrl: string
    automationId: string | null
}): Promise<string | null> {
    try {
        const model = await getModel('anthropic', 'claude-sonnet-4-20250514')
        const prompt = `You are a political editor. Write a short news post (2-4 sentences) giving just enough context for this video clip.

Video: "${clip.videoTitle || 'Unknown'}"
Channel: ${clip.channelName || 'Unknown'}
Key Quote: "${clip.keyQuote || ''}"
Context: ${clip.clipRationale || ''}

Rules:
- Open with the most newsworthy thing that was said
- Be specific: name the speaker, the topic, the stakes
- Don't start with "In a", "During a", or "A clip"
- 2-4 sentences only
- Return ONLY the paragraph, no title`

        const result = await generateText({ model, prompt })
        const context = result.text.trim()

        const title = clip.keyQuote
            ? `"${clip.keyQuote.substring(0, 80)}${clip.keyQuote.length > 80 ? '...' : ''}"`
            : clip.videoTitle || 'New Clip'

        const quoteBlock = clip.keyQuote
            ? `> "${clip.keyQuote}"\n> — **${clip.channelName || clip.videoTitle || 'Source'}** · [Watch full video](${clip.youtubeUrl})\n\n`
            : ''

        // Embed the actual clip (MP4), not the full YouTube video
        const clipEmbed = `<video controls style="width:100%;border-radius:8px;margin:1em 0;max-height:480px" src="${clip.clipUrl}"></video>\n\n`

        const content = `${clipEmbed}${quoteBlock}${context}\n\n*Source: [${clip.videoTitle || clip.youtubeUrl}](${clip.youtubeUrl})*`

        const baseSlug = title.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .substring(0, 80)
            .replace(/-+$/, '')
        const slug = `${baseSlug}-${Date.now()}`

        const [article] = await db.insert(articles).values({
            title,
            slug,
            content,
            summary: context.substring(0, 200),
            tags: ['video-clip'],
            status: 'published',
            automationId: clip.automationId ?? null,
            publishedAt: new Date(),
        }).returning()

        console.log(`[onClipReady] ✓ Article generated: ${article.id}`)
        return article.id
    } catch (e: any) {
        console.error(`[onClipReady] Article generation failed: ${e.message}`)
        return null
    }
}

/**
 * Called by the Apify webhook when a video clip is ready.
 * Downloads from Apify, uploads to Vercel Blob, generates article, posts to platforms.
 */
export async function onClipReady(clipId: string, apifyClipUrl: string): Promise<void> {
    console.log(`[onClipReady] Clip ${clipId} ready`)

    try {
        const videoRes = await fetch(apifyClipUrl)
        if (!videoRes.ok) throw new Error(`Failed to fetch clip: ${videoRes.status}`)
        const buffer = await videoRes.arrayBuffer()

        const blob = await put(`clips/${clipId}.mp4`, buffer, {
            access: 'public',
            contentType: 'video/mp4',
        })
        console.log(`[onClipReady] ✓ Uploaded to Blob: ${blob.url}`)

        const [clip] = await db.update(videoClips)
            .set({ clipUrl: blob.url, status: 'done', processedAt: new Date() })
            .where(eq(videoClips.id, clipId))
            .returning()

        if (!clip) throw new Error('Clip record not found')

        // Auto-generate site article for every clip
        const articleId = await generateClipArticle({
            id: clip.id,
            videoTitle: clip.videoTitle,
            youtubeUrl: clip.youtubeUrl,
            channelName: clip.channelName,
            keyQuote: clip.keyQuote,
            clipRationale: clip.clipRationale,
            clipUrl: blob.url,
            automationId: clip.automationId,
        })
        if (articleId) {
            await db.update(videoClips).set({ articleId }).where(eq(videoClips.id, clipId))
        }

        // Platform auto-posting (only for clips tied to a monitor with the flag enabled)
        if (!clip.automationId) return
        const automation = await db.query.automations.findFirst({
            where: eq(automations.id, clip.automationId)
        })
        if (!automation) return

        const config = automation.config as Record<string, any>
        const videoBuffer = Buffer.from(buffer)

        // Post to X
        if (config.postX) {
            try {
                const xRes = await postToX({
                    content: clip.clipRationale || clip.videoTitle || 'New video',
                    title: clip.videoTitle || 'New Video',
                    xFormat: config.xFormat ?? 'post',
                    xTweetCount: config.xTweetCount ?? 1,
                    videoClipUrl: blob.url,
                    videoSourceUrl: clip.youtubeUrl,
                })
                await db.update(videoClips).set({ xPostedAt: new Date(), xPostId: xRes || null }).where(eq(videoClips.id, clipId))
                console.log(`[onClipReady] ✓ Posted to X`)
            } catch (e: any) {
                console.error(`[onClipReady] X post failed: ${e.message}`)
                await db.update(videoClips)
                    .set({ errorMessage: `Clip saved but X post failed: ${e.message}` })
                    .where(eq(videoClips.id, clipId))
            }
        }

        // Post to Bluesky
        if (config.postBluesky) {
            try {
                const { postToBluesky } = await import('@/lib/social/bluesky')
                const text = clip.keyQuote
                    ? `"${clip.keyQuote}" — ${clip.videoTitle || ''}\n\n${clip.youtubeUrl}`
                    : `${clip.clipRationale || clip.videoTitle || 'New clip'}\n\n${clip.youtubeUrl}`
                const bskyUri = await postToBluesky({ text, videoBuffer })
                await db.update(videoClips)
                    .set({ blueskyPostId: bskyUri, blueskyPostedAt: new Date() })
                    .where(eq(videoClips.id, clipId))
                console.log(`[onClipReady] ✓ Posted to Bluesky`)
            } catch (e: any) {
                console.error(`[onClipReady] Bluesky post failed: ${e.message}`)
            }
        }

        // Post to Threads
        if (config.postThreads) {
            try {
                const { postToThreads } = await import('@/lib/social/threads')
                const text = clip.keyQuote
                    ? `"${clip.keyQuote}" — ${clip.videoTitle || ''}\n\n${clip.youtubeUrl}`
                    : `${clip.clipRationale || clip.videoTitle || 'New clip'}\n\n${clip.youtubeUrl}`
                const threadsId = await postToThreads({ text })
                await db.update(videoClips)
                    .set({ threadsPostId: threadsId, threadsPostedAt: new Date() })
                    .where(eq(videoClips.id, clipId))
                console.log(`[onClipReady] ✓ Posted to Threads`)
            } catch (e: any) {
                console.error(`[onClipReady] Threads post failed: ${e.message}`)
            }
        }

        // Post to TikTok
        if (config.postTiktok) {
            try {
                const { postToTiktok } = await import('@/lib/social/tiktok')
                const tiktokId = await postToTiktok({
                    title: clip.videoTitle || clip.clipRationale || 'New clip',
                    videoBuffer,
                })
                await db.update(videoClips)
                    .set({ tiktokPostId: tiktokId, tiktokPostedAt: new Date() })
                    .where(eq(videoClips.id, clipId))
                console.log(`[onClipReady] ✓ Posted to TikTok`)
            } catch (e: any) {
                console.error(`[onClipReady] TikTok post failed: ${e.message}`)
            }
        }

    } catch (e: any) {
        console.error(`[onClipReady] Failed: ${e.message}`)
        await db.update(videoClips)
            .set({ status: 'failed', errorMessage: e.message })
            .where(eq(videoClips.id, clipId))
    }
}

/**
 * Run a video monitor — check YouTube RSS for new videos and queue clips.
 */
export async function runVideoMonitor(automation: Automation): Promise<{
    success: boolean
    skipped?: boolean
    reason?: string
    clipsQueued?: number
    error?: string
}> {
    const config = automation.config as Record<string, any>
    const channelId = config.channelId as string
    if (!channelId) return { success: false, error: 'No channelId configured' }

    const lastRun = automation.lastRunAt ? new Date(automation.lastRunAt) : new Date(0)
    const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`

    try {
        const feed = await parser.parseURL(feedUrl)
        const newVideos = feed.items.filter(item => {
            const pub = item.pubDate ? new Date(item.pubDate) : new Date(0)
            return pub > lastRun
        })

        if (newVideos.length === 0) {
            const result = { success: true, skipped: true, reason: 'No new videos' }
            await db.update(automations)
                .set({ lastRunAt: new Date(), lastResult: result })
                .where(eq(automations.id, automation.id))
            return result
        }

        let clipsQueued = 0
        for (const item of newVideos.slice(0, 3)) {
            const url = item.link || ''
            if (!url) continue
            queueVideoClip(url, item.title || undefined, automation.id)
                .catch(e => console.error(`[runVideoMonitor] Queue failed for ${url}:`, e.message))
            clipsQueued++
        }

        const result = { success: true, clipsQueued }
        await db.update(automations)
            .set({ lastRunAt: new Date(), lastResult: result })
            .where(eq(automations.id, automation.id))
        return result

    } catch (e: any) {
        const result = { success: false, error: e.message }
        await db.update(automations)
            .set({ lastRunAt: new Date(), lastResult: result })
            .where(eq(automations.id, automation.id))
        return result
    }
}
