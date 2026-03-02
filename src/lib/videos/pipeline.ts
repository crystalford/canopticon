import { generateText } from 'ai'
import { getModel } from '@/lib/ai/providers'
import { db, videoClips, automations } from '@/db'
import { eq } from 'drizzle-orm'
import { put } from '@vercel/blob'
import { TwitterApi } from 'twitter-api-v2'
import { getCredential } from '@/lib/social/credentials'
import { transcodeForTwitter } from '@/lib/social/cloudinary'
import RSSParser from 'rss-parser'
import type { Automation } from '@/db/schema'

const parser = new RSSParser()

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Fetch video metadata (description + channelName) from the YouTube page.
 * Parses JSON-LD schema — no API key required.
 */
async function fetchVideoMetadata(youtubeUrl: string): Promise<{ description: string; channelName: string }> {
    try {
        const res = await fetch(youtubeUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        })
        if (!res.ok) return { description: '', channelName: '' }
        const html = await res.text()

        let description = ''
        let channelName = ''

        const ldMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
        if (ldMatch) {
            try {
                const ld = JSON.parse(ldMatch[1])
                if (ld.description) description = ld.description
                if (ld.author?.name) channelName = ld.author.name
            } catch { /* ignore */ }
        }

        if (!description) {
            const ogMatch = html.match(/<meta\s+(?:property="og:description"|name="description")\s+content="([^"]+)"/)
            if (ogMatch) description = ogMatch[1].replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&')
        }

        return { description, channelName }
    } catch {
        return { description: '', channelName: '' }
    }
}

/**
 * Direct YouTube caption fetch — fast (~1s) but may fail on cloud provider IPs
 * (YouTube sometimes blocks/strips data for Vercel/AWS requests).
 * Uses bracket counting to safely extract nested JSON from the page source.
 */
async function fetchYouTubeTranscriptDirect(youtubeUrl: string): Promise<Array<{ start: number; text: string }>> {
    const videoId = youtubeUrl.match(/[?&]v=([^&]+)/)?.[1]
    if (!videoId) throw new Error('Invalid YouTube URL — could not extract video ID')

    const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
        },
    })
    if (!pageRes.ok) throw new Error(`YouTube page fetch failed: ${pageRes.status}`)
    const html = await pageRes.text()

    // Bracket counting — more robust than regex for nested JSON objects
    const idx = html.indexOf('"captionTracks":[')
    if (idx === -1) throw new Error('No captionTracks found in page (may be blocked or missing captions)')
    const arrayStart = idx + '"captionTracks":'.length
    let depth = 0, arrayEnd = arrayStart
    for (let i = arrayStart; i < html.length; i++) {
        if (html[i] === '[') depth++
        else if (html[i] === ']') { depth--; if (depth === 0) { arrayEnd = i + 1; break } }
    }
    const arrayJson = html.substring(arrayStart, arrayEnd)
        .replace(/\\u0026/g, '&').replace(/\\u003d/g, '=').replace(/\\u003c/g, '<').replace(/\\u003e/g, '>')
    const tracks = JSON.parse(arrayJson)

    const track = tracks.find((t: any) => t.vssId?.startsWith('a.en'))
        || tracks.find((t: any) => t.languageCode === 'en')
    if (!track?.baseUrl) throw new Error('No English captions found — video may be in another language')

    const captionRes = await fetch(track.baseUrl + '&fmt=json3')
    if (!captionRes.ok) throw new Error(`Caption fetch failed: ${captionRes.status}`)
    const data = await captionRes.json()
    return (data.events || [])
        .filter((e: any) => e.segs && e.tStartMs !== undefined)
        .map((e: any) => ({
            start: e.tStartMs / 1000,
            text: e.segs.map((s: any) => s.utf8 || '').join('').replace(/\n/g, ' ').trim(),
        }))
        .filter((s: any) => s.text)
}

/**
 * Apify transcript actor with POLLING — reliable fallback when direct YouTube fetch fails.
 * Polls every 5s for up to 90s. No webhook needed.
 */
async function fetchTranscriptViaApify(youtubeUrl: string): Promise<Array<{ start: number; text: string }>> {
    const token = process.env.APIFY_API_TOKEN
    if (!token) throw new Error('APIFY_API_TOKEN not configured')

    const startRes = await fetch(
        `https://api.apify.com/v2/acts/leandrocb88~youtube-video-transcript-scraper/runs?token=${token}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ startUrls: [{ url: youtubeUrl }] }),
        }
    )
    if (!startRes.ok) throw new Error(`Failed to start Apify transcript actor: ${await startRes.text()}`)
    const startData = await startRes.json()
    const runId = startData.data?.id
    if (!runId) throw new Error('No run ID returned from Apify')
    console.log(`[fetchTranscript/Apify] Started run ${runId}, polling every 5s...`)

    for (let i = 0; i < 18; i++) {  // 18 × 5s = 90s max
        await new Promise(r => setTimeout(r, 5000))
        const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${token}`)
        if (!statusRes.ok) continue
        const { data } = await statusRes.json()
        console.log(`[fetchTranscript/Apify] Poll ${i + 1}: ${data?.status}`)
        if (data?.status === 'SUCCEEDED') {
            const dataRes = await fetch(`https://api.apify.com/v2/datasets/${data.defaultDatasetId}/items?token=${token}`)
            const items = await dataRes.json()
            if (!items?.[0]?.transcript?.length) throw new Error('No transcript in Apify result — captions may be disabled on this video')
            const segments = items[0].transcript as Array<{ start: number; text: string }>
            console.log(`[fetchTranscript/Apify] ✓ ${segments.length} segments`)
            return segments
        }
        if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(data?.status)) {
            throw new Error(`Apify transcript actor ${data.status.toLowerCase()}`)
        }
    }
    throw new Error('Apify transcript actor timed out after 90s')
}

/**
 * Fetch transcript — tries direct YouTube first (fast), falls back to Apify polling (reliable).
 */
async function fetchTranscript(youtubeUrl: string): Promise<Array<{ start: number; text: string }>> {
    try {
        const segments = await fetchYouTubeTranscriptDirect(youtubeUrl)
        if (segments.length > 0) {
            console.log(`[fetchTranscript] ✓ Direct: ${segments.length} segments`)
            return segments
        }
        console.warn('[fetchTranscript] Direct fetch returned 0 segments — falling back to Apify')
    } catch (e: any) {
        console.warn(`[fetchTranscript] Direct fetch failed: ${e.message} — falling back to Apify`)
    }
    return fetchTranscriptViaApify(youtubeUrl)
}

/**
 * Use Perplexity to identify a speaker when title/transcript/description don't name them.
 */
async function lookupSpeaker(keyQuote: string, videoTitle: string, channelName: string): Promise<string> {
    try {
        const model = await getModel('perplexity', 'sonar-pro')
        const query = `Who said this quote in a Canadian Parliament, news conference, or media context? Quote: "${keyQuote.substring(0, 120)}" — Video title: "${videoTitle}", Channel: "${channelName}". Reply with ONLY the full name of the speaker (first and last name), or the word "unknown" if you cannot determine it with confidence.`
        const result = await generateText({ model, prompt: query })
        const name = result.text.trim().replace(/^["']|["']$/g, '').split('\n')[0].trim()
        if (!name || name.toLowerCase() === 'unknown' || name.length > 60 || name.includes(' ')) {
            return name.toLowerCase() === 'unknown' ? '' : name
        }
        return ''
    } catch (e: any) {
        console.warn(`[lookupSpeaker] Web search failed: ${e.message}`)
        return ''
    }
}

/**
 * Ensure the speaker name appears at the front of the tweet draft.
 * If Claude identified the speaker in the draft already, leave it alone.
 * If found via lookup, prepend "Name: " and trim to 240 chars.
 */
function withSpeaker(tweetDraft: string, speakerName: string | null | undefined): string {
    if (!speakerName || !tweetDraft) return tweetDraft
    if (tweetDraft.toLowerCase().includes(speakerName.toLowerCase())) return tweetDraft
    const result = `${speakerName}: ${tweetDraft}`
    return result.length <= 240 ? result : result.substring(0, 237) + '...'
}

const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `[${m}:${sec.toString().padStart(2, '0')}]`
}

const toHHMMSS = (secs: number) => {
    const h = Math.floor(secs / 3600).toString().padStart(2, '0')
    const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0')
    const s = (secs % 60).toString().padStart(2, '0')
    return `${h}:${m}:${s}`
}

async function selectClipWindow(
    url: string,
    title: string,
    transcript: string,
    description = ''
): Promise<{ start: number; end: number; rationale: string; keyQuote: string; extendedQuote: string; speakerName: string; tweetDraft: string }> {
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
- message: 2-3 sentences in plain English summarizing WHAT the clip is arguing/claiming and WHY it matters politically. This is not a quote — explain the substance of what is being said and what makes it significant. Include any key statistics or data points mentioned.
- key_quote: the SINGLE most quotable clean sentence from the clip. Exact transcript words only, but remove filler words (um, uh, like, you know). No surrounding quotes in the string.
- extended_quote: 2-4 consecutive sentences from the clip that include the key_quote moment. Remove filler words (um, uh, like, you know) while preserving exact meaning and structure. No surrounding quotes in the string.
- speaker_name: the full name of the person saying the key_quote. Use these sources in order: (1) the video title — e.g. "Pierre Poilievre responds to..." → "Pierre Poilievre"; (2) explicit name introductions in the transcript — e.g. "I'm joined by Mark Carney" → "Mark Carney"; (3) the video description if it lists specific speakers; (4) if the speaker's role, party, and quote content together make identification highly confident, you may name them. If any reasonable doubt remains, use null.
- tweet_draft: the most engaging tweet for this clip. Use verbatim transcript words when they are clean and punchy. If the message is more shareable as a paraphrase, write one. Format: if speaker is known → 'Full Name: "quote or paraphrase"'. If unknown → '"quote or paraphrase" — [key stat or context]'. STRICT RULES: no emojis, no em dashes (—), no all-caps words, write like a human not a press release. Under 240 chars.

Video: "${title}"
URL: ${url}${description ? `\nDescription: ${description.substring(0, 1000)}` : ''}

Timestamped transcript:
${transcript}

Return ONLY valid JSON, no markdown:
{"start_seconds": <number>, "end_seconds": <number>, "message": "<what the clip is saying and why it matters>", "key_quote": "<clean single sentence, no filler words, no surrounding quotes>", "extended_quote": "<2-4 clean sentences, no filler words, no surrounding quotes>", "speaker_name": "<full name or null>", "tweet_draft": "<tweet text>"}`

    const result = await generateText({ model, prompt })
    const match = result.text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('AI failed to return clip timestamps')
    const parsed = JSON.parse(match[0])
    if (typeof parsed.start_seconds !== 'number' || typeof parsed.end_seconds !== 'number') {
        throw new Error('AI returned invalid timestamp format')
    }
    return {
        start: parsed.start_seconds,
        end: parsed.end_seconds,
        rationale: parsed.message || parsed.rationale || '',
        keyQuote: (parsed.key_quote || '').replace(/^["']|["']$/g, ''),
        extendedQuote: (parsed.extended_quote || parsed.key_quote || '').replace(/^["']|["']$/g, ''),
        speakerName: parsed.speaker_name || '',
        tweetDraft: parsed.tweet_draft || '',
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
                // Request H.264/AAC MP4 — required for Twitter upload (browser playback accepts WebM, Twitter doesn't)
                videoCodec: 'h264',
                audioCodec: 'aac',
                outputFormat: 'mp4',
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
 * Fetches YouTube captions directly (no Apify transcript actor),
 * runs Claude to pick the best clip window, then triggers the Apify video clipper.
 * The clipper webhook (/api/webhooks/apify) handles the rest.
 */
export async function queueVideoClip(
    youtubeUrl: string,
    videoTitle?: string,
    automationId?: string
): Promise<string> {
    const title = videoTitle && videoTitle !== 'Loading...' ? videoTitle : ''

    const [clip] = await db.insert(videoClips).values({
        youtubeUrl,
        videoTitle: title || null,
        status: 'queued',
        automationId: automationId ?? null,
    }).returning({ id: videoClips.id })

    console.log(`[queueVideoClip] Created clip ${clip.id}`)

    if (!process.env.APIFY_API_TOKEN) {
        await db.update(videoClips)
            .set({ status: 'failed', errorMessage: 'APIFY_API_TOKEN not configured' })
            .where(eq(videoClips.id, clip.id))
        return clip.id
    }

    try {
        // Fetch transcript (direct YouTube → Apify polling fallback) + metadata in parallel
        console.log(`[queueVideoClip] Fetching transcript + metadata for ${clip.id}...`)
        const [segments, { description, channelName }] = await Promise.all([
            fetchTranscript(youtubeUrl),
            fetchVideoMetadata(youtubeUrl),
        ])

        if (segments.length === 0) throw new Error('No transcript segments returned — captions may be disabled on this video')
        console.log(`[queueVideoClip] ✓ ${segments.length} transcript segments, channel: ${channelName}`)

        // Store metadata
        await db.update(videoClips)
            .set({ videoTitle: title || null, channelName: channelName || null })
            .where(eq(videoClips.id, clip.id))

        // Build timestamped transcript for Claude
        const transcript = segments.map(s => `${formatTime(s.start)} ${s.text}`).join('\n')

        // Claude picks best clip window
        const { start, end, rationale, keyQuote, extendedQuote, speakerName: speakerFromClip, tweetDraft } =
            await selectClipWindow(youtubeUrl, title, transcript, description)
        console.log(`[queueVideoClip] AI selected ${start}s→${end}s: ${rationale}`)

        // Speaker lookup via web search if not identified from title/transcript
        let speakerName = speakerFromClip
        if (!speakerName && keyQuote) {
            console.log(`[queueVideoClip] Speaker unknown — trying web lookup...`)
            speakerName = await lookupSpeaker(keyQuote, title, channelName)
            if (speakerName) console.log(`[queueVideoClip] Speaker identified: ${speakerName}`)
        }

        // Extract verbatim clip segment
        const clipSegments = segments.filter(s => s.start >= start - 2 && s.start <= end + 2)
        const transcriptSegment = clipSegments.map(s => s.text).join(' ')
        const finalTweetDraft = withSpeaker(tweetDraft, speakerName)

        await db.update(videoClips)
            .set({ startSeconds: start, endSeconds: end, clipRationale: rationale, keyQuote, extendedQuote, speakerName, tweetDraft: finalTweetDraft, transcriptSegment, status: 'processing' })
            .where(eq(videoClips.id, clip.id))

        // Trigger Apify video clipper — webhook at /api/webhooks/apify handles completion
        await triggerApify(clip.id, youtubeUrl, start, end, automationId)

    } catch (e: any) {
        console.error(`[queueVideoClip] Failed for ${clip.id}:`, e.message)
        await db.update(videoClips)
            .set({ status: 'failed', errorMessage: e.message })
            .where(eq(videoClips.id, clip.id))
    }

    return clip.id
}

/**
 * ASYNC path — for YouTube PubSubHubbub webhook and automated monitor runs.
 * Creates the DB record and fires the Apify transcript actor with a webhook callback.
 * Returns immediately (~1s). The transcript webhook handles the rest of the pipeline.
 * Use queueVideoClip() instead when you have time to wait (manual clips).
 */
export async function startAsyncClipProcessing(
    youtubeUrl: string,
    videoTitle?: string,
    automationId?: string
): Promise<string> {
    const title = videoTitle && videoTitle !== 'Loading...' ? videoTitle : ''
    const [clip] = await db.insert(videoClips).values({
        youtubeUrl,
        videoTitle: title || null,
        status: 'queued',
        automationId: automationId ?? null,
    }).returning({ id: videoClips.id })
    console.log(`[startAsyncClipProcessing] Created clip ${clip.id}`)

    const token = process.env.APIFY_API_TOKEN
    if (!token) {
        await db.update(videoClips).set({ status: 'failed', errorMessage: 'APIFY_API_TOKEN not configured' }).where(eq(videoClips.id, clip.id))
        return clip.id
    }

    try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${process.env.VERCEL_URL}` || 'http://localhost:3000'
        const webhookUrl = `${baseUrl}/api/webhooks/transcript?clipId=${clip.id}`
        const webhooksParam = Buffer.from(JSON.stringify([{
            eventTypes: ['ACTOR.RUN.SUCCEEDED', 'ACTOR.RUN.FAILED'],
            requestUrl: webhookUrl,
        }])).toString('base64')
        const res = await fetch(
            `https://api.apify.com/v2/acts/leandrocb88~youtube-video-transcript-scraper/runs?token=${token}&webhooks=${encodeURIComponent(webhooksParam)}`,
            { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ startUrls: [{ url: youtubeUrl }] }) }
        )
        if (!res.ok) throw new Error(`Apify transcript start failed: ${await res.text()}`)
        const run = await res.json()
        console.log(`[startAsyncClipProcessing] ✓ Transcript run ${run.data?.id} started`)
    } catch (e: any) {
        console.error(`[startAsyncClipProcessing] Failed to start transcript for ${clip.id}:`, e.message)
        await db.update(videoClips).set({ status: 'failed', errorMessage: e.message }).where(eq(videoClips.id, clip.id))
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

        const item = transcriptItems[0]
        // Log available fields so we can see what the Apify actor returns (check Vercel logs)
        console.log(`[onTranscriptReady] Dataset item keys: ${Object.keys(item).join(', ')}`)

        const segments = item.transcript as Array<{ start: number; text: string }>
        const transcript = segments.map(s => `${formatTime(s.start)} ${s.text.trim()}`).join('\n')

        // Pull metadata from Apify response
        const videoTitle = clip.videoTitle || item.title || item.videoTitle || ''
        const channelName = item.channelName || item.author || clip.channelName || ''

        // Get description from Apify output or YouTube page
        let videoDescription = item.description || item.videoDescription || item.about || ''
        if (!videoDescription) {
            const meta = await fetchVideoMetadata(clip.youtubeUrl)
            videoDescription = meta.description
        }

        // Store title/channel if not already set
        const metaUpdates: Record<string, string> = {}
        if (!clip.videoTitle && videoTitle) metaUpdates.videoTitle = videoTitle
        if (!clip.channelName && channelName) metaUpdates.channelName = channelName
        if (Object.keys(metaUpdates).length) {
            await db.update(videoClips).set(metaUpdates).where(eq(videoClips.id, clipId))
        }

        // Claude picks best clip window (gets full description for speaker ID)
        const { start, end, rationale, keyQuote, extendedQuote, speakerName: speakerFromClip, tweetDraft } = await selectClipWindow(clip.youtubeUrl, videoTitle, transcript, videoDescription)
        console.log(`[onTranscriptReady] AI selected ${start}s→${end}s: ${rationale}`)

        // If speaker not identified from title/transcript/description, try a web search
        let speakerName = speakerFromClip
        if (!speakerName && keyQuote) {
            console.log(`[onTranscriptReady] Speaker unknown — trying web search lookup...`)
            speakerName = await lookupSpeaker(keyQuote, videoTitle, channelName)
            if (speakerName) console.log(`[onTranscriptReady] Speaker identified via web search: ${speakerName}`)
            else console.log(`[onTranscriptReady] Speaker could not be identified`)
        }

        // Extract the verbatim text of the selected clip window
        const clipSegments = segments.filter(s => s.start >= start - 2 && s.start <= end + 2)
        const transcriptSegment = clipSegments.map(s => s.text.trim()).join(' ')
        const finalTweetDraft = withSpeaker(tweetDraft, speakerName)

        await db.update(videoClips)
            .set({ startSeconds: start, endSeconds: end, clipRationale: rationale, keyQuote, extendedQuote, speakerName, tweetDraft: finalTweetDraft, transcriptSegment, status: 'processing' })
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

        // Fetch automation config for platform posting flags
        const automation = clip.automationId
            ? await db.query.automations.findFirst({ where: eq(automations.id, clip.automationId) })
            : null
        const config = (automation?.config ?? {}) as Record<string, any>

        // Platform auto-posting (only for clips tied to a monitor with the flag enabled)
        if (!clip.automationId || !automation) return
        const videoBuffer = Buffer.from(buffer)

        // Post to X — use keyQuote verbatim, no AI generation
        if (config.postX) {
            try {
                const apiKey = await getCredential('TWITTER_API_KEY')
                const apiSecret = await getCredential('TWITTER_API_SECRET')
                const xAccessToken = await getCredential('TWITTER_ACCESS_TOKEN')
                const xAccessSecret = await getCredential('TWITTER_ACCESS_SECRET')
                if (!apiKey || !apiSecret || !xAccessToken || !xAccessSecret) throw new Error('X credentials not configured')

                const xClient = new TwitterApi({ appKey: apiKey, appSecret: apiSecret, accessToken: xAccessToken, accessSecret: xAccessSecret })
                const rawTweet = clip.tweetDraft || (clip.keyQuote
                    ? `"${clip.keyQuote}"\n\n— ${clip.channelName || clip.videoTitle || 'Source'}`
                    : clip.videoTitle || 'New clip')
                const tweetText = withSpeaker(rawTweet, clip.speakerName)

                let xMediaId: string | undefined
                try {
                    const twitterBuffer = await transcodeForTwitter(videoBuffer, '[onClipReady/X]')
                    xMediaId = await xClient.v1.uploadMedia(twitterBuffer, { mimeType: 'video/mp4' })
                } catch (e) {
                    console.warn('[onClipReady] X video upload failed:', e)
                }

                const xTweet = await xClient.v2.tweet(tweetText, xMediaId ? { media: { media_ids: [xMediaId] } } : {})
                await db.update(videoClips).set({ xPostedAt: new Date(), xPostId: xTweet.data.id }).where(eq(videoClips.id, clipId))
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
                const text = clip.tweetDraft || (clip.keyQuote
                    ? `"${clip.keyQuote}"\n\n— ${clip.channelName || clip.videoTitle || 'Source'}`
                    : clip.videoTitle || 'New clip')
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

const FRENCH_TITLE_PATTERNS = ['en français', 'en francais', '(fr)', 'allocution', 'conférence de presse']

function isFrenchTitle(title: string): boolean {
    const t = title.toLowerCase()
    return FRENCH_TITLE_PATTERNS.some(p => t.includes(p))
}

/**
 * Run a video monitor — check YouTube RSS for new videos and queue clips.
 * Pass force=true to process the latest video regardless of lastRunAt (for manual testing).
 */
export async function runVideoMonitor(automation: Automation, { force = false }: { force?: boolean } = {}): Promise<{
    success: boolean
    skipped?: boolean
    reason?: string
    clipsQueued?: number
    skippedFrench?: number
    error?: string
}> {
    const config = automation.config as Record<string, any>
    const channelId = config.channelId as string
    if (!channelId) return { success: false, error: 'No channelId configured' }

    const lastRun = automation.lastRunAt ? new Date(automation.lastRunAt) : new Date(0)
    const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`

    try {
        const feed = await parser.parseURL(feedUrl)

        let candidates = force
            ? feed.items.slice(0, 1) // force mode: just the latest video
            : feed.items.filter(item => {
                const pub = item.pubDate ? new Date(item.pubDate) : new Date(0)
                return pub > lastRun
            })

        // Skip French/non-English videos
        let skippedFrench = 0
        const englishVideos = candidates.filter(item => {
            if (item.title && isFrenchTitle(item.title)) {
                console.log(`[runVideoMonitor] Skipping French video: ${item.title}`)
                skippedFrench++
                return false
            }
            return true
        })

        if (englishVideos.length === 0) {
            const reason = skippedFrench > 0 ? 'Only French videos found — skipped' : 'No new videos'
            const result = { success: true, skipped: true, reason, skippedFrench }
            await db.update(automations)
                .set({ lastRunAt: new Date(), lastResult: result })
                .where(eq(automations.id, automation.id))
            return result
        }

        let clipsQueued = 0
        for (const item of englishVideos.slice(0, 2)) {
            const url = item.link || ''
            if (!url) continue
            // Use async path — cron doesn't need to block on 90s transcript polling
            await startAsyncClipProcessing(url, item.title || undefined, automation.id)
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
