import { generateText, stepCountIs } from 'ai'
import { getModel } from '@/lib/ai/providers'
import { createTools } from '@/lib/ai/tools'
import { searchPerplexity } from '@/lib/ai/tools'
import { db, automations, articles, videoClips } from '@/db'
import { processVideoClip, triggerClippingJob } from '@/lib/videos/processor'
import { settings as settingsTable } from '@/db/schema'
import { eq } from 'drizzle-orm'
import RSSParser from 'rss-parser'
import type { Automation } from '@/db/schema'
import { TwitterApi } from 'twitter-api-v2'
import { fetchTranscript } from './transcript'
import { franc } from 'franc'

// Resolve a credential: DB settings table first (editable via UI), then env var
async function getCredential(key: string): Promise<string | undefined> {
    try {
        const row = await db.query.settings.findFirst({ where: eq(settingsTable.key, key) })
        if (row?.value) return row.value
    } catch { /* settings table not ready */ }
    return process.env[key]
}

// Detect if content is in English (requires transcript, no fallback)
function isEnglish(transcript: string | null): boolean {
    if (!transcript || transcript.length < 50) {
        throw new Error('No transcript available for language detection')
    }
    try {
        const language = franc(transcript)
        const isEnglishLang = language === 'eng'
        console.log(`[isEnglish] Detected language: ${language} (English: ${isEnglishLang})`)
        return isEnglishLang
    } catch (e: any) {
        throw new Error(`Language detection failed: ${e.message}`)
    }
}

const parser = new RSSParser()

const DEFAULT_RESEARCH_PROVIDER = 'perplexity'
const DEFAULT_RESEARCH_MODEL = 'sonar-pro'
const DEFAULT_WRITING_PROVIDER = 'openai'
const DEFAULT_WRITING_MODEL = 'gpt-4o'

const JOURNALIST_SYSTEM_PROMPT = `You are Canopticon, an investigative AI journalist.

CORE RULES:
1. Write a specific news article about the EVENT in the content.
2. Do NOT write a meta-review. Focus on the subject matter itself.
3. For YouTube videos: ALWAYS begin by embedding the video using <youtube>VIDEO_ID</youtube> (extract ID from URL).
4. Use search_web to find the real story and background behind this specific event.
5. Tone: Objective, Detailed, Journalistic.
6. ALWAYS use the publish_article tool to save the article when done.

HEADLINE RULES (critical):
- NEVER use the YouTube video title as the article title. That is a lazy placeholder.
- Write a specific, journalistic headline that captures the most newsworthy moment, debate, or revelation from the actual content.
- Good: "Liberals Defend Carbon Tax as Conservatives Demand Emergency Debate" or "NATO Partners Reject Ukraine Ceasefire Terms at Brussels Summit"
- Bad: "Question Period – February 24, 2026" or "CPAC Live: House of Commons"
- The headline should tell someone who knows nothing about it what actually happened.

IMAGE RULES (critical):
- If you generate or embed any images, they must be PHOTOJOURNALISTIC style.
- NEVER embed text, words, letters, captions, headlines, or watermarks into the image itself. AI image generators corrupt text — do not include any.
- Good prompt: "A wide shot of the Canadian House of Commons chamber during a heated debate, photojournalistic, natural lighting, no text"
- Bad prompt: anything with overlay text, banners, titles, or subtitles in the image.`

// ── Output Flags ─────────────────────────────────────────────────────────────
// Individual output toggles. Replaces the old single 'outputMode' string.

export interface OutputFlags {
    writeArticle: boolean       // write and publish an article
    articleDraft: boolean       // save as draft instead of publishing (only if writeArticle)
    clipVideo: boolean          // clip the video via Apify (YouTube only, async)
    postX: boolean              // post to X/Twitter
    xFormat: 'thread' | 'post' // thread = multi-tweet, post = single tweet
    xTweetCount: number         // number of tweets in a thread (3–5)
    includeArticleLink: boolean // link to article URL in X post (vs YouTube URL)
}

// Derive flags from config — supports both new individual flags and legacy outputMode string
export function getOutputFlags(config: Record<string, unknown>): OutputFlags {
    // New-style: individual flags (writeArticle or postX present)
    if ('writeArticle' in config || 'postX' in config) {
        return {
            writeArticle: (config.writeArticle as boolean) ?? true,
            articleDraft: (config.articleDraft as boolean) ?? false,
            clipVideo: (config.clipVideo as boolean) ?? false,
            postX: (config.postX as boolean) ?? false,
            xFormat: (config.xFormat as 'thread' | 'post') ?? 'thread',
            xTweetCount: Math.max(3, Math.min(5, (config.xTweetCount as number) ?? 4)),
            includeArticleLink: (config.includeArticleLink as boolean) ?? false,
        }
    }
    // Legacy: derive from old outputMode string
    const mode = (config.outputMode as string) || 'article_and_x'
    return {
        writeArticle: mode !== 'x_only',
        articleDraft: mode === 'draft',
        clipVideo: (config.videoClippingEnabled as boolean) ?? false,
        postX: ['article_and_x', 'article_and_x_post', 'x_only'].includes(mode),
        xFormat: mode === 'article_and_x_post' ? 'post' : 'thread',
        xTweetCount: 4,
        includeArticleLink: false,
    }
}

// ── Unified X/Twitter Posting ─────────────────────────────────────────────────

export async function postToX({
    content,
    title,
    linkUrl,
    xFormat,
    xTweetCount,
    xThreadPrompt,
    videoClipUrl,
    videoSourceUrl,
}: {
    content: string           // article body or transcript to write tweets from
    title: string
    linkUrl?: string          // link for CTA in last tweet (undefined = no link)
    xFormat: 'thread' | 'post'
    xTweetCount: number
    xThreadPrompt?: string    // custom tone/style instructions
    videoClipUrl?: string     // native MP4 to upload to first tweet
    videoSourceUrl?: string   // YouTube URL for thumbnail fallback
}): Promise<string> {
    const apiKey = await getCredential('TWITTER_API_KEY')
    const apiSecret = await getCredential('TWITTER_API_SECRET')
    const accessToken = await getCredential('TWITTER_ACCESS_TOKEN')
    const accessSecret = await getCredential('TWITTER_ACCESS_SECRET')

    if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
        throw new Error('X/Twitter API credentials not configured')
    }

    const client = new TwitterApi({ appKey: apiKey, appSecret: apiSecret, accessToken, accessSecret })
    const chatModel = await getModel(DEFAULT_WRITING_PROVIDER, DEFAULT_WRITING_MODEL)

    let tweets: string[]

    if (xFormat === 'post') {
        // Single tweet
        const ctaLine = linkUrl ? `\nEnd with: ${linkUrl}` : ''
        const defaultPrompt = `You are a political media strategist. Extract the SINGLE most newsworthy, surprising, or quotable moment from this content. Write ONE punchy tweet.

Format:
Line 1: The moment — lead with a direct quote or the most surprising fact.
Line 2: One sentence of context.${ctaLine}

Under 280 characters total. No hashtags. Return ONLY the tweet text, no quotes or JSON.`

        const prompt = `${xThreadPrompt || defaultPrompt}\n\nTitle: ${title}\n\nContent:\n${content.substring(0, 3000)}`
        const result = await generateText({ model: chatModel, prompt })
        tweets = [result.text.trim().replace(/^["']|["']$/g, '')]
    } else {
        // Thread
        const ctaLine = linkUrl
            ? `Last tweet ends with "Watch: ${linkUrl}"`
            : 'Last tweet ends with a sharp question or provocative statement'

        const defaultPrompt = `You are a political media strategist writing high-engagement X/Twitter posts. Extract the most newsworthy, surprising, or quotable moments. Each tweet must work as a completely standalone post.

TWEET FORMAT:
Line 1: The moment — lead with the most surprising/provocative element. If it's a quote, use quotation marks and name the speaker.
Line 2: One sentence of context.
Line 3: A sharp question or provocative statement.

RULES:
- Each tweet stands alone — no "continued from above" references
- Be specific: names, numbers, policy names, dates — not vague generalities
- ${ctaLine}
- Under 280 characters each
- No hashtags
- Return ONLY a valid JSON array of strings`

        const prompt = `${xThreadPrompt || defaultPrompt}\n\nTitle: ${title}\n\nContent:\n${content.substring(0, 4000)}\n\nExtract ${xTweetCount} tweets. Return ONLY a JSON array.`
        const result = await generateText({ model: chatModel, prompt })

        const jsonMatch = result.text.match(/\[[\s\S]*\]/)
        if (!jsonMatch) throw new Error('AI failed to generate a tweet array')
        tweets = JSON.parse(jsonMatch[0])
        if (!Array.isArray(tweets)) throw new Error('Invalid tweet format returned by AI')
        tweets = tweets.map((t: string) => t.replace(/\s*\(\d+\s+chars?[^)]*\)/gi, '').trim())
    }

    // Upload native video clip or fall back to YouTube thumbnail for first tweet
    let firstTweetMediaId: string | undefined

    if (videoClipUrl) {
        try {
            console.log(`[postToX] Uploading native video clip: ${videoClipUrl}`)
            const videoRes = await fetch(videoClipUrl)
            if (videoRes.ok) {
                const buffer = Buffer.from(await videoRes.arrayBuffer())
                const mediaId = await client.v1.uploadMedia(buffer, { mimeType: 'video/mp4' })
                firstTweetMediaId = mediaId
                console.log(`[postToX] Native video uploaded: ${mediaId}`)
            }
        } catch (e) {
            console.warn('[postToX] Video upload failed, falling back to thumbnail:', e)
        }
    }

    if (!firstTweetMediaId && videoSourceUrl) {
        try {
            const { extractVideoId } = await import('./transcript')
            const videoId = extractVideoId(videoSourceUrl)
            if (videoId) {
                const thumbUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
                const thumbRes = await fetch(thumbUrl)
                if (thumbRes.ok) {
                    const buffer = Buffer.from(await thumbRes.arrayBuffer())
                    const mediaId = await client.v1.uploadMedia(buffer, { mimeType: 'image/jpeg' })
                    firstTweetMediaId = mediaId
                }
            }
        } catch (e) {
            console.warn('[postToX] Thumbnail upload failed (non-fatal):', e)
        }
    }

    // Post tweets
    let lastTweetId: string | undefined
    const postedTweets: { id: string; text: string }[] = []

    for (let i = 0; i < tweets.length; i++) {
        const params: any = { text: tweets[i] }
        if (lastTweetId) params.reply = { in_reply_to_tweet_id: lastTweetId }
        if (i === 0 && firstTweetMediaId) params.media = { media_ids: [firstTweetMediaId] }
        const tweetResult = await client.v2.tweet(params)
        lastTweetId = tweetResult.data.id
        postedTweets.push({ id: tweetResult.data.id, text: tweets[i] })
        if (i < tweets.length - 1) await new Promise(r => setTimeout(r, 500))
    }

    return `https://x.com/i/status/${postedTweets[0].id}`
}

// Backward-compat wrappers used by the Apify webhook
export async function generateAndPostThread(
    articleId: string,
    articleTitle: string,
    articleSlug: string,
    sourceUrl?: string,
    xThreadPrompt?: string,
    videoClipUrl?: string
): Promise<string> {
    const article = await db.query.articles.findFirst({ where: eq(articles.id, articleId) })
    if (!article) throw new Error('Article not found')
    return postToX({
        content: article.content,
        title: articleTitle,
        linkUrl: sourceUrl,
        xFormat: 'thread',
        xTweetCount: 4,
        xThreadPrompt,
        videoClipUrl,
        videoSourceUrl: sourceUrl,
    })
}

export async function generateAndPostSingle(
    articleId: string,
    articleTitle: string,
    articleSlug: string,
    sourceUrl?: string,
    xThreadPrompt?: string,
    videoClipUrl?: string
): Promise<string> {
    const article = await db.query.articles.findFirst({ where: eq(articles.id, articleId) })
    if (!article) throw new Error('Article not found')
    return postToX({
        content: article.content,
        title: articleTitle,
        linkUrl: sourceUrl,
        xFormat: 'post',
        xTweetCount: 1,
        xThreadPrompt,
        videoClipUrl,
        videoSourceUrl: sourceUrl,
    })
}

// ── Article Generation ────────────────────────────────────────────────────────

async function generateArticle(
    triggerContent: string,
    automation: Automation,
    saveDraft: boolean = false
): Promise<{ success: boolean; articleId?: string; error?: string }> {
    const config = automation.config as Record<string, unknown>

    const instructions = automation.prompt || 'Write a news article about this content.'
    const publishMode = saveDraft
        ? 'Save the article as a draft using the publish_article tool with status=draft.'
        : 'Publish the article using the publish_article tool.'

    const fullPrompt = `${instructions}\n\n${publishMode}\n\nNew content detected:\n${triggerContent}`

    const tools = createTools(undefined, { saveDraft })

    const researchProvider = ((config.researchProvider as string) || DEFAULT_RESEARCH_PROVIDER) as 'openai' | 'perplexity' | 'anthropic'
    const researchModelId = (config.researchModel as string) || DEFAULT_RESEARCH_MODEL
    const writingProvider = ((config.writingProvider as string) || DEFAULT_WRITING_PROVIDER) as 'openai' | 'perplexity' | 'anthropic'
    const writingModelId = (config.writingModel as string) || DEFAULT_WRITING_MODEL

    console.log(`[generateArticle] draft=${saveDraft} | Research: ${researchProvider}/${researchModelId} | Writing: ${writingProvider}/${writingModelId}`)

    const writingModel = await getModel(writingProvider, writingModelId)

    await generateText({
        model: writingModel,
        system: JOURNALIST_SYSTEM_PROMPT,
        prompt: fullPrompt,
        tools,
        stopWhen: stepCountIs(10),
    })

    // Find article created in last 60 seconds
    const recentArticle = await db.query.articles.findFirst({
        where: (t, { gte }) => gte(t.createdAt, new Date(Date.now() - 60000)),
        orderBy: (t, { desc }) => [desc(t.createdAt)],
    })

    if (recentArticle) {
        await db.update(articles)
            .set({ automationId: automation.id })
            .where(eq(articles.id, recentArticle.id))
        return { success: true, articleId: recentArticle.id }
    }

    return { success: false, error: 'AI ran but no article was created.' }
}

// ── Main Runner (cron + manual run) ──────────────────────────────────────────

export async function runAutomation(automation: Automation): Promise<{
    success: boolean
    error?: string
    skipped?: boolean
    reason?: string
    articleId?: string
    threadUrl?: string
    xPostError?: string
}> {
    console.log(`[runAutomation] Pipeline: ${automation.name} (${automation.type})`)

    const config = automation.config as Record<string, unknown>
    const flags = getOutputFlags(config)

    const triggerContent = await checkTrigger(automation)

    if (!triggerContent) {
        const result = { success: true, skipped: true, reason: 'No new content found' }
        await db.update(automations).set({ lastRunAt: new Date(), lastResult: result }).where(eq(automations.id, automation.id))
        return result
    }

    // Duplicate guard: skip if we already have an article for this exact video URL
    if (automation.type === 'youtube') {
        const urlMatch = triggerContent.match(/^URL: (.+)/m)
        const videoUrl = urlMatch?.[1]?.trim()
        if (videoUrl) {
            const existing = await db.query.articles.findFirst({
                where: (t, { and, eq: eqFn, like }) => and(
                    eqFn(t.automationId, automation.id),
                    like(t.content, `%${videoUrl}%`)
                ),
            })
            if (existing) {
                const result = { success: true, skipped: true, reason: `Already covered: ${videoUrl}` }
                await db.update(automations).set({ lastRunAt: new Date(), lastResult: result }).where(eq(automations.id, automation.id))
                return result
            }
        }
    }

    try {
        // Extract video URL for linking/thumbnail (YouTube only)
        const videoUrlMatch = triggerContent.match(/URL: (.+)/m)
        const videoUrl = automation.type === 'youtube' ? videoUrlMatch?.[1]?.trim() : undefined

        // Step 1: Write article (if enabled)
        let articleId: string | undefined
        let article: { id: string; title: string; slug: string; content: string } | null | undefined = null

        if (flags.writeArticle) {
            const { success, articleId: aid, error } = await generateArticle(triggerContent, automation, flags.articleDraft)
            if (!success) {
                const result = { success: false, error: error || 'Unknown error' }
                await db.update(automations).set({ lastRunAt: new Date(), lastResult: result }).where(eq(automations.id, automation.id))
                return result
            }
            articleId = aid
            if (articleId) article = await db.query.articles.findFirst({ where: eq(articles.id, articleId) })
        }

        // Step 2: Post to X (if enabled)
        // Note: clipping is only triggered in processYouTubeVideo (YouTube webhook path)
        let threadUrl: string | undefined
        let xPostError: string | undefined

        if (flags.postX) {
            try {
                const content = article?.content || triggerContent
                const title = article?.title || (triggerContent.match(/Video Title: (.+)/)?.[1]?.trim() ?? 'New Content')
                const linkUrl = (flags.includeArticleLink && article)
                    ? `https://canopticon.com/articles/${article.slug}`
                    : videoUrl

                threadUrl = await postToX({
                    content,
                    title,
                    linkUrl,
                    xFormat: flags.xFormat,
                    xTweetCount: flags.xTweetCount,
                    xThreadPrompt: config.xThreadPrompt as string | undefined,
                    videoSourceUrl: videoUrl,
                })
            } catch (e: any) {
                xPostError = e.message
                console.error('[runAutomation] X post failed:', e)
            }
        }

        const result = { success: true, articleId, threadUrl, xPostError, error: xPostError }
        await db.update(automations).set({ lastRunAt: new Date(), lastResult: result }).where(eq(automations.id, automation.id))
        return result

    } catch (error) {
        console.error('[runAutomation] Error:', error)
        const message = error instanceof Error ? error.message : String(error)
        const result = { success: false, error: message }
        await db.update(automations).set({ lastRunAt: new Date(), lastResult: result }).where(eq(automations.id, automation.id))
        return result
    }
}

// ── YouTube Video Processor (called from YouTube webhook) ─────────────────────

export async function processYouTubeVideo(
    video: { title: string; link: string; pubDate?: string; description: string },
    automation: Automation
) {
    console.log(`[processYouTubeVideo] Processing video: ${video.title}`)

    try {
        const config = automation.config as Record<string, unknown>
        const flags = getOutputFlags(config)

        // 1. Fetch transcript
        const transcript = await fetchTranscript(video.link)
        const transcriptSection = transcript
            ? `\nTranscript (${transcript.split(/\s+/).length} words):\n${transcript}`
            : '\n[No transcript available — use search_web to find coverage of this video]'

        const triggerData = `Video Title: ${video.title}\nURL: ${video.link}\nPublished: ${video.pubDate}\nDescription: ${video.description}${transcriptSection}`

        // 2. Write article (if enabled)
        let articleId: string | undefined
        let article: { id: string; title: string; slug: string; content: string } | null | undefined = null

        if (flags.writeArticle) {
            console.log(`[processYouTubeVideo] Writing article for: ${video.title}`)
            const { success, articleId: aid, error } = await generateArticle(triggerData, automation, flags.articleDraft)

            if (!success || !aid) {
                const result = { success: false, error: error || 'Failed to generate article' }
                await db.update(automations).set({ lastRunAt: new Date(), lastResult: result }).where(eq(automations.id, automation.id))
                return result
            }
            articleId = aid
            article = await db.query.articles.findFirst({ where: eq(articles.id, articleId) })
        }

        // 3. Clip video async (if enabled) — webhook handles X posting when clip is ready
        if (flags.clipVideo) {
            try {
                console.log(`[processYouTubeVideo] Triggering async clip for: ${video.title}`)
                const [clipRecord] = await db.insert(videoClips).values({
                    youtubeUrl: video.link,
                    videoTitle: video.title,
                    status: 'queued',
                    automationId: automation.id
                }).returning()

                if (clipRecord) {
                    triggerClippingJob(clipRecord.id, video.link, articleId, automation.id)
                        .catch(e => console.error(`[processYouTubeVideo] Clip trigger failed:`, e.message))

                    const result = { success: true, articleId, status: 'clipping_in_progress' }
                    await db.update(automations).set({ lastRunAt: new Date(), lastResult: result }).where(eq(automations.id, automation.id))
                    return result
                }
            } catch (e: any) {
                console.warn(`[processYouTubeVideo] Clip trigger failed (non-fatal): ${e.message}`)
            }
        }

        // 4. Post to X immediately (if postX, no clip queued)
        let threadUrl: string | undefined
        let xPostError: string | undefined

        if (flags.postX) {
            try {
                const content = article?.content || transcript || triggerData
                const title = article?.title || video.title
                const linkUrl = (flags.includeArticleLink && article)
                    ? `https://canopticon.com/articles/${article.slug}`
                    : video.link

                threadUrl = await postToX({
                    content,
                    title,
                    linkUrl,
                    xFormat: flags.xFormat,
                    xTweetCount: flags.xTweetCount,
                    xThreadPrompt: config.xThreadPrompt as string | undefined,
                    videoSourceUrl: video.link,
                })
            } catch (e: any) {
                xPostError = e.message
                console.error('[processYouTubeVideo] X post failed:', e)
            }
        }

        const result = { success: true, articleId, threadUrl, xPostError, error: xPostError }
        await db.update(automations).set({ lastRunAt: new Date(), lastResult: result }).where(eq(automations.id, automation.id))
        return result

    } catch (error: any) {
        console.error('[processYouTubeVideo] Fatal Error:', error)
        const result = { success: false, error: error.message }
        await db.update(automations).set({ lastRunAt: new Date(), lastResult: result }).where(eq(automations.id, automation.id))
        return result
    }
}

// ── Trigger Checker (cron / polling) ─────────────────────────────────────────

async function checkTrigger(automation: Automation): Promise<string | null> {
    const lastRun = automation.lastRunAt ? new Date(automation.lastRunAt) : new Date(0)
    const config = automation.config as Record<string, unknown>

    switch (automation.type) {
        case 'youtube': {
            const channelId = config.channelId as string
            if (!channelId) return null
            const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
            try {
                const feed = await parser.parseURL(feedUrl)
                const newItems = feed.items.filter(item => {
                    const pubDate = item.pubDate ? new Date(item.pubDate) : new Date(0)
                    return pubDate > lastRun
                })
                if (newItems.length === 0) return null

                // Find first English video (must have transcript, skip non-English)
                let latest = null
                for (const item of newItems) {
                    const videoUrl = item.link || ''
                    const transcript = await fetchTranscript(videoUrl)

                    if (!transcript) {
                        console.log(`[checkTrigger] Skipping "${item.title}" — no transcript available`)
                        continue
                    }

                    try {
                        if (isEnglish(transcript)) {
                            latest = { item, videoUrl, transcript }
                            break
                        } else {
                            console.log(`[checkTrigger] Skipping non-English video: ${item.title}`)
                        }
                    } catch (langError: any) {
                        console.log(`[checkTrigger] Language detection failed for "${item.title}": ${langError.message}`)
                    }
                }

                if (!latest) {
                    console.log('[checkTrigger] No English videos with transcripts found')
                    return null
                }

                const transcriptSection = `\nTranscript (${latest.transcript.split(/\s+/).length} words):\n${latest.transcript}`
                return `Video Title: ${latest.item.title}\nURL: ${latest.videoUrl}\nPublished: ${latest.item.pubDate}\nDescription: ${latest.item.contentSnippet || ''}${transcriptSection}`
            } catch (e) {
                console.error('[checkTrigger] RSS Error:', e)
                return null
            }
        }
        case 'rss': {
            const feedUrl = config.feedUrl as string
            if (!feedUrl) return null
            try {
                const feed = await parser.parseURL(feedUrl)
                const newItems = feed.items.filter(item => {
                    const pubDate = item.pubDate ? new Date(item.pubDate) : new Date(0)
                    return pubDate > lastRun
                })
                if (newItems.length === 0) return null
                return newItems.slice(0, 5)
                    .map(item => `Title: ${item.title}\nLink: ${item.link}\nSummary: ${item.contentSnippet}`)
                    .join('\n---\n')
            } catch (e) {
                console.error('[checkTrigger] RSS Error:', e)
                return null
            }
        }
        case 'keyword': {
            const keywords = config.keywords as string[]
            if (!keywords?.length) return null
            try {
                return await searchPerplexity(keywords.join(' OR ') + ' latest news')
            } catch (e) {
                console.error('[checkTrigger] Keyword Error:', e)
                return null
            }
        }
        default:
            return null
    }
}
