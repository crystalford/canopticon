import { generateText } from 'ai'
import { getModel } from '@/lib/ai/providers'
import { db, videoClips, automations } from '@/db'
import { articles } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { put } from '@vercel/blob'
import { TwitterApi } from 'twitter-api-v2'
import { getCredential } from '@/lib/social/credentials'
import RSSParser from 'rss-parser'
import type { Automation } from '@/db/schema'

const parser = new RSSParser()

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Fetch YouTube video description by scraping the page.
 * Tries og:description and JSON-LD schema — no API key required.
 */
async function fetchYoutubeDescription(youtubeUrl: string): Promise<string> {
    try {
        const res = await fetch(youtubeUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        })
        if (!res.ok) return ''
        const html = await res.text()

        // Try JSON-LD schema first — usually has the full description
        const ldMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
        if (ldMatch) {
            try {
                const ld = JSON.parse(ldMatch[1])
                if (ld.description) return ld.description
            } catch { /* ignore parse errors */ }
        }

        // Fallback: og:description meta tag (~160 chars)
        const ogMatch = html.match(/<meta\s+(?:property="og:description"|name="description")\s+content="([^"]+)"/)
        if (ogMatch) return ogMatch[1].replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&')

        return ''
    } catch {
        return ''
    }
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

        const item = transcriptItems[0]
        // Log available fields so we can see what the Apify actor returns (check Vercel logs)
        console.log(`[onTranscriptReady] Dataset item keys: ${Object.keys(item).join(', ')}`)

        const segments = item.transcript as Array<{ start: number; text: string }>
        const formatTime = (s: number) => {
            const m = Math.floor(s / 60)
            const sec = Math.floor(s % 60)
            return `[${m}:${sec.toString().padStart(2, '0')}]`
        }
        const transcript = segments.map(s => `${formatTime(s.start)} ${s.text.trim()}`).join('\n')

        // Pull metadata from Apify response
        const videoTitle = clip.videoTitle || item.title || item.videoTitle || ''
        const channelName = item.channelName || item.author || clip.channelName || ''

        // Get description: try Apify output first, then fetch from YouTube directly
        let videoDescription = item.description || item.videoDescription || item.about || ''
        if (!videoDescription) {
            console.log(`[onTranscriptReady] No description from Apify — fetching from YouTube...`)
            videoDescription = await fetchYoutubeDescription(clip.youtubeUrl)
            if (videoDescription) console.log(`[onTranscriptReady] Fetched YouTube description (${videoDescription.length} chars)`)
        } else {
            console.log(`[onTranscriptReady] Description from Apify (${videoDescription.length} chars)`)
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

        // Extract the verbatim text of the selected clip window (for article generation)
        const clipSegments = segments.filter(s => s.start >= start - 2 && s.start <= end + 2)
        const transcriptSegment = clipSegments.map(s => s.text.trim()).join(' ')

        await db.update(videoClips)
            .set({ startSeconds: start, endSeconds: end, clipRationale: rationale, keyQuote, extendedQuote, speakerName, tweetDraft, transcriptSegment, status: 'processing' })
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
    extendedQuote: string | null
    speakerName: string | null
    clipRationale: string | null
    transcriptSegment: string | null
    clipUrl: string
    automationId: string | null
}): Promise<string | null> {
    try {
        const model = await getModel('anthropic', 'claude-sonnet-4-20250514')
        const source = clip.channelName || clip.videoTitle || 'Unknown'
        const transcript = clip.transcriptSegment || clip.extendedQuote || clip.keyQuote || ''

        const prompt = `You are a senior editor at a Canadian political intelligence publication. Write a substantive article from this video clip transcript.

Source video: "${clip.videoTitle || source}"
Channel: ${source}
Primary speaker identified: ${clip.speakerName || 'unknown — identify from transcript'}
What the clip is about: ${clip.clipRationale || ''}

VERBATIM CLIP TRANSCRIPT:
${transcript}

---

Write a full article. Rules:
- Use ONLY what is in the transcript above — no external facts, no assumptions
- Identify each speaker accurately from how they introduce themselves in the transcript (NOT from the video title alone)
- If multiple people speak, cover all of them
- Extract all specific data points (dollar figures, percentages, timelines, program names, institution names)
- Write like a Canadian political journalist, not a press release
- Do not start sentences with "In a..." or "During a..."

Return ONLY valid JSON, no markdown fences:
{
  "title": "Compelling headline under 90 chars — plain statement, not a quote",
  "lede": "1-2 sentence news lede: who did/said what and why it matters",
  "body": "3-4 paragraphs of substantive reporting. Cover the key claims, data points, and significance. Use the transcript to quote accurately.",
  "tags": ["array", "of", "flat", "tags — person names (firstname-lastname), org names, topics, locations. Include video-clip."]
}`

        const result = await generateText({ model, prompt })
        const match = result.text.match(/\{[\s\S]*\}/)

        let title: string
        let lede: string
        let body: string
        let tags: string[] = ['video-clip']

        if (match) {
            try {
                const parsed = JSON.parse(match[0])
                title = parsed.title || clip.videoTitle || 'New Clip'
                lede = parsed.lede || ''
                body = parsed.body || ''
                if (Array.isArray(parsed.tags)) tags = parsed.tags
            } catch {
                // JSON parse failed — use raw text as body
                title = clip.videoTitle || 'New Clip'
                lede = ''
                body = result.text.trim()
            }
        } else {
            title = clip.videoTitle || 'New Clip'
            lede = ''
            body = result.text.trim()
        }

        // Blockquote: pull quote from the clip
        const displayQuote = clip.extendedQuote || clip.keyQuote || ''
        const attribution = clip.speakerName
            ? `**${clip.speakerName}** · [Watch full video](${clip.youtubeUrl})`
            : `**${source}** · [Watch full video](${clip.youtubeUrl})`
        const quoteBlock = displayQuote
            ? `> ${displayQuote}\n> — ${attribution}\n\n`
            : ''

        // Article layout: embed → pull quote → lede → body → source
        const clipEmbed = `<video controls style="width:100%;border-radius:8px;margin:1em 0;max-height:480px" src="${clip.clipUrl}"></video>\n\n`
        const ledeFormatted = lede ? `**${lede}**\n\n` : ''
        const content = `${clipEmbed}${quoteBlock}${ledeFormatted}${body}\n\n*Source: [${clip.videoTitle || clip.youtubeUrl}](${clip.youtubeUrl})*`

        const baseSlug = title.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .substring(0, 80)
            .replace(/-+$/, '')
        const slug = `${baseSlug}-${Date.now()}`

        // Ensure video-clip tag always present
        if (!tags.includes('video-clip')) tags.unshift('video-clip')

        const [article] = await db.insert(articles).values({
            title,
            slug,
            content,
            summary: lede || body.split('\n')[0] || '',
            tags,
            status: 'published',
            automationId: clip.automationId ?? null,
            publishedAt: new Date(),
        }).returning()

        console.log(`[onClipReady] ✓ Article generated: ${article.id} — tags: ${tags.join(', ')}`)
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

        // Auto-generate site article (unless clipArticle is explicitly disabled)
        let articleId: string | null = null
        if (config.clipArticle !== false) {
            articleId = await generateClipArticle({
                id: clip.id,
                videoTitle: clip.videoTitle,
                youtubeUrl: clip.youtubeUrl,
                channelName: clip.channelName,
                keyQuote: clip.keyQuote,
                extendedQuote: clip.extendedQuote,
                speakerName: clip.speakerName,
                clipRationale: clip.clipRationale,
                transcriptSegment: clip.transcriptSegment,
                clipUrl: blob.url,
                automationId: clip.automationId,
            })
        } else {
            console.log(`[onClipReady] Skipping article generation (clipArticle disabled)`)
        }
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

        // Post to X — use keyQuote verbatim, no AI generation
        if (config.postX) {
            try {
                const apiKey = await getCredential('TWITTER_API_KEY')
                const apiSecret = await getCredential('TWITTER_API_SECRET')
                const xAccessToken = await getCredential('TWITTER_ACCESS_TOKEN')
                const xAccessSecret = await getCredential('TWITTER_ACCESS_SECRET')
                if (!apiKey || !apiSecret || !xAccessToken || !xAccessSecret) throw new Error('X credentials not configured')

                const xClient = new TwitterApi({ appKey: apiKey, appSecret: apiSecret, accessToken: xAccessToken, accessSecret: xAccessSecret })
                const tweetText = clip.tweetDraft || (clip.keyQuote
                    ? `"${clip.keyQuote}"\n\n— ${clip.channelName || clip.videoTitle || 'Source'}`
                    : clip.videoTitle || 'New clip')

                let xMediaId: string | undefined
                try {
                    xMediaId = await xClient.v1.uploadMedia(videoBuffer, { mimeType: 'video/mp4' })
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
