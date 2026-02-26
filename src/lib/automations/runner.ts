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
import { detect } from 'franc'

// Resolve a credential: DB settings table first (editable via UI), then env var
async function getCredential(key: string): Promise<string | undefined> {
    try {
        const row = await db.query.settings.findFirst({ where: eq(settingsTable.key, key) })
        if (row?.value) return row.value
    } catch { /* settings table not ready */ }
    return process.env[key]
}

// Detect if content is in English (returns true if English, false otherwise)
function isEnglish(text: string): boolean {
    if (!text || text.length < 50) return true // If text is too short, assume it's OK
    try {
        const language = detect(text)
        // language is a string like 'eng', 'fra', etc.
        return language === 'eng'
    } catch {
        return true // If detection fails, assume English
    }
}

const parser = new RSSParser()

// Output modes:
// 'article_and_x_post' - write full article + post ONE high-impact X tweet
// 'article_only'       - write article, no X
// 'draft'              - write article, save as draft
// 'x_only'             - skip AI entirely, just post a link tweet when new content drops

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

// --- Helper: post X/Twitter link (x_only mode — no AI, just a link post) ---
async function postXLink(
    title: string,
    link: string,
    description?: string
): Promise<string> {
    const apiKey = await getCredential('TWITTER_API_KEY')
    const apiSecret = await getCredential('TWITTER_API_SECRET')
    const accessToken = await getCredential('TWITTER_ACCESS_TOKEN')
    const accessSecret = await getCredential('TWITTER_ACCESS_SECRET')

    if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
        throw new Error('X/Twitter API credentials not configured')
    }

    const snippet = description?.substring(0, 200)?.trim()
    const text = `🆕 ${title}\n\n${snippet ? snippet + '\n\n' : ''}${link}`

    const client = new TwitterApi({ appKey: apiKey, appSecret: apiSecret, accessToken, accessSecret })
    const result = await client.v2.tweet({ text })
    return `https://x.com/i/status/${result.data.id}`
}

// --- Helper: post X/Twitter thread (article_and_x mode) ---
export async function generateAndPostThread(
    articleId: string,
    articleTitle: string,
    articleSlug: string,
    sourceUrl?: string,       // If provided, last tweet links here instead of the article
    xThreadPrompt?: string,    // Custom instructions for the thread (from config.xThreadPrompt)
    videoClipUrl?: string
): Promise<string> {
    console.log(`[generateAndPostThread] Generating thread for: ${articleTitle} (Video: ${videoClipUrl ? 'YES' : 'NO'})`)

    const apiKey = await getCredential('TWITTER_API_KEY')
    const apiSecret = await getCredential('TWITTER_API_SECRET')
    const accessToken = await getCredential('TWITTER_ACCESS_TOKEN')
    const accessSecret = await getCredential('TWITTER_ACCESS_SECRET')

    if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
        throw new Error('X/Twitter API credentials not configured')
    }

    const article = await db.query.articles.findFirst({ where: eq(articles.id, articleId) })
    if (!article) throw new Error('Article not found')

    const linkUrl = sourceUrl || `https://canopticon.com/articles/${articleSlug}`
    const wordCount = article.content.split(/\s+/).length
    const numTweets = wordCount < 500 ? 3 : wordCount < 1500 ? 4 : 5
    const lastTweetCta = sourceUrl ? 'Watch:' : 'Full analysis:'

    const defaultThreadInstructions = `You are a political media strategist writing high-engagement X/Twitter posts. Your job is to EXTRACT the most newsworthy, surprising, or quotable moments from this content and write one tweet per moment. Each tweet must work as a completely standalone post — someone who sees only that tweet should get full value from it.

EXTRACTION RULES:
- Scan for: direct quotes from politicians/officials, surprising statistics or reversals, conflict between parties, specific policy positions, anything that would make someone say "wait, what?"
- Each tweet = ONE extracted moment. Not a summary. Not a transition. One specific thing.

TWEET FORMAT (each tweet):
Line 1: The moment itself — lead with the most surprising/provocative element. If it's a quote, use quotation marks and name the speaker.
Line 2 (optional): One sentence of context that makes it land harder.
Line 3: End with EITHER a sharp question that invites a reply ("What does this mean for X?") OR a provocative statement that makes people want to share it.

RULES:
- Every tweet must be able to stand alone — no "continued from above" references
- Be specific: names, numbers, policy names, dates — not vague generalities
- Last tweet ends with "${lastTweetCta} ${linkUrl}"
- Under 280 characters each
- No hashtags
- Return ONLY a valid JSON array of strings`

    const threadInstructions = xThreadPrompt || defaultThreadInstructions

    const prompt = `${threadInstructions}

Article Title: ${articleTitle}
Article Content: ${article.content.substring(0, 4000)}

Extract ${numTweets} tweets. Return ONLY a JSON array.`

    const chatModel = await getModel(DEFAULT_WRITING_PROVIDER, DEFAULT_WRITING_MODEL)
    const result = await generateText({ model: chatModel, prompt })

    let tweets: string[]
    try {
        const jsonMatch = result.text.match(/\[[\s\S]*\]/)
        if (!jsonMatch) throw new Error('No JSON array found')
        tweets = JSON.parse(jsonMatch[0])
        if (!Array.isArray(tweets)) throw new Error('Invalid format')
        tweets = tweets.map((t: string) =>
            t.replace(/\s*\(\d+\s+chars?[^)]*\)/gi, '').trim()
        )
    } catch (error) {
        throw new Error(`Failed to parse thread: ${error}`)
    }

    const client = new TwitterApi({ appKey: apiKey, appSecret: apiSecret, accessToken, accessSecret })

    // Attach Video or Thumbnail to first tweet
    let firstTweetMediaId: string | undefined

    if (videoClipUrl) {
        try {
            console.log(`[generateAndPostThread] Uploading video for first tweet from: ${videoClipUrl}`)
            const videoRes = await fetch(videoClipUrl)
            if (videoRes.ok) {
                const buffer = Buffer.from(await videoRes.arrayBuffer())
                const mediaId = await client.v1.uploadMedia(buffer, { mimeType: 'video/mp4' })
                firstTweetMediaId = mediaId
            }
        } catch (e) {
            console.warn('[generateAndPostThread] Video upload failed, falling back to thumbnail:', e)
        }
    }

    if (!firstTweetMediaId && sourceUrl) {
        try {
            const { extractVideoId } = await import('./transcript')
            const videoId = extractVideoId(sourceUrl)
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
            console.warn('[generateAndPostThread] Thumbnail upload failed (non-fatal):', e)
        }
    }

    let lastTweetId: string | undefined
    const postedTweets: { id: string; text: string }[] = []

    for (let i = 0; i < tweets.length; i++) {
        const text = tweets[i]
        const params: any = { text }
        if (lastTweetId) params.reply = { in_reply_to_tweet_id: lastTweetId }
        if (i === 0 && firstTweetMediaId) params.media = { media_ids: [firstTweetMediaId] }
        const tweetResult = await client.v2.tweet(params)
        lastTweetId = tweetResult.data.id
        postedTweets.push({ id: tweetResult.data.id, text })
        // Small delay to avoid rate limit burst
        if (i < tweets.length - 1) await new Promise(r => setTimeout(r, 500))
    }

    return `https://x.com/i/status/${postedTweets[0].id}`
}

// --- Helper: post ONE high-impact X post (article_and_x_post mode) ---
export async function generateAndPostSingle(
    articleId: string,
    articleTitle: string,
    articleSlug: string,
    sourceUrl?: string,
    xThreadPrompt?: string,
    videoClipUrl?: string
): Promise<string> {
    console.log(`[generateAndPostSingle] Generating single post for: ${articleTitle} (Video: ${videoClipUrl ? 'YES' : 'NO'})`)

    const apiKey = await getCredential('TWITTER_API_KEY')
    const apiSecret = await getCredential('TWITTER_API_SECRET')
    const accessToken = await getCredential('TWITTER_ACCESS_TOKEN')
    const accessSecret = await getCredential('TWITTER_ACCESS_SECRET')

    if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
        throw new Error('X/Twitter API credentials not configured')
    }

    const article = await db.query.articles.findFirst({ where: eq(articles.id, articleId) })
    if (!article) throw new Error('Article not found')

    const linkUrl = sourceUrl || `https://canopticon.com/articles/${articleSlug}`
    const lastTweetCta = sourceUrl ? 'Watch:' : 'Read:'

    const defaultInstructions = xThreadPrompt || `You are a political media strategist. Extract the SINGLE most newsworthy, surprising, or quotable moment from this article. Write ONE tweet about it.

Format:
Line 1: The moment — lead with a direct quote or the most surprising fact.
Line 2: One sentence of context.
Line 3: End with "${lastTweetCta} ${linkUrl}"

Under 280 characters total. No hashtags. Return ONLY the tweet text, no JSON.`

    const prompt = `${defaultInstructions}

Article Title: ${articleTitle}
Article Content: ${article.content.substring(0, 3000)}`

    const chatModel = await getModel(DEFAULT_WRITING_PROVIDER, DEFAULT_WRITING_MODEL)
    const result = await generateText({ model: chatModel, prompt })
    const tweetText = result.text.trim().replace(/^["']|["']$/g, '')

    const client = new TwitterApi({ appKey: apiKey, appSecret: apiSecret, accessToken, accessSecret })

    const params: any = { text: tweetText }

    // 1. Try to attach the Video Clip if provided
    if (videoClipUrl) {
        try {
            console.log(`[generateAndPostSingle] Attempting video upload from: ${videoClipUrl}`)
            const videoRes = await fetch(videoClipUrl)
            if (videoRes.ok) {
                const buffer = Buffer.from(await videoRes.arrayBuffer())
                // Video upload to X can take time, use v1 for media upload
                const mediaId = await client.v1.uploadMedia(buffer, { mimeType: 'video/mp4' })
                params.media = { media_ids: [mediaId] }
                console.log(`[generateAndPostSingle] Video uploaded successfully: ${mediaId}`)
            }
        } catch (e) {
            console.warn('[generateAndPostSingle] Video upload failed, falling back to thumbnail:', e)
        }
    }

    // 2. Fallback to YouTube thumbnail if no video attached
    if (!params.media && sourceUrl) {
        try {
            const { extractVideoId } = await import('./transcript')
            const videoId = extractVideoId(sourceUrl)
            if (videoId) {
                const thumbUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
                const thumbRes = await fetch(thumbUrl)
                if (thumbRes.ok) {
                    const buffer = Buffer.from(await thumbRes.arrayBuffer())
                    const mediaId = await client.v1.uploadMedia(buffer, { mimeType: 'image/jpeg' })
                    params.media = { media_ids: [mediaId] }
                }
            }
        } catch (e) {
            console.warn('[generateAndPostSingle] Thumbnail upload failed (non-fatal):', e)
        }
    }

    const tweetResult = await client.v2.tweet(params)
    return `https://x.com/i/status/${tweetResult.data.id}`
}

// --- Core article generation ---
async function generateArticle(
    triggerContent: string,
    automation: Automation
): Promise<{ success: boolean; articleId?: string; error?: string }> {
    const config = automation.config as Record<string, unknown>
    const outputMode = (config.outputMode as string) || 'article_and_x'
    const saveDraft = outputMode === 'draft'

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

    console.log(`[generateArticle] Mode: ${outputMode} | Research: ${researchProvider}/${researchModelId} | Writing: ${writingProvider}/${writingModelId}`)

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
        // Link article to this pipeline
        await db.update(articles)
            .set({ automationId: automation.id })
            .where(eq(articles.id, recentArticle.id))
        return { success: true, articleId: recentArticle.id }
    }

    return { success: false, error: 'AI ran but no article was created.' }
}

// --- Main Runner (called by cron + manual run) ---
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
    const outputMode = (config.outputMode as string) || 'article_and_x'

    const triggerContent = await checkTrigger(automation)

    if (!triggerContent) {
        const result = { success: true, skipped: true, reason: 'No new content found' }
        await db.update(automations)
            .set({ lastRunAt: new Date(), lastResult: result })
            .where(eq(automations.id, automation.id))
        return result
    }

    // Duplicate guard: if we already have an article for this exact video URL, skip
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
                await db.update(automations)
                    .set({ lastRunAt: new Date(), lastResult: result })
                    .where(eq(automations.id, automation.id))
                return result
            }
        }
    }

    try {
        // x_only mode: skip AI, just post a link
        if (outputMode === 'x_only') {
            // Extract title and link from trigger content
            const titleMatch = triggerContent.match(/Video Title: (.+)/)
            const linkMatch = triggerContent.match(/URL: (.+)/)
            const descMatch = triggerContent.match(/Description: ([\s\S]+)/)
            const title = titleMatch?.[1] || 'New Content'
            const link = linkMatch?.[1] || ''
            const desc = descMatch?.[1]?.substring(0, 200)

            let threadUrl: string | undefined
            let xPostError: string | undefined
            try {
                threadUrl = await postXLink(title, link, desc)
            } catch (e: any) {
                xPostError = e.message
            }

            const result = { success: !xPostError, threadUrl, xPostError, error: xPostError }
            await db.update(automations)
                .set({ lastRunAt: new Date(), lastResult: result })
                .where(eq(automations.id, automation.id))
            return result
        }

        // All other modes: generate article
        const { success, articleId, error } = await generateArticle(triggerContent, automation)

        if (!success) {
            const result = { success: false, error: error || 'Unknown error' }
            await db.update(automations)
                .set({ lastRunAt: new Date(), lastResult: result })
                .where(eq(automations.id, automation.id))
            return result
        }

        const article = articleId ? await db.query.articles.findFirst({ where: eq(articles.id, articleId) }) : null

        let threadUrl: string | undefined
        let xPostError: string | undefined

        if (outputMode === 'article_and_x' && article) {
            try {
                // For YouTube pipelines, link to the source video instead of the article
                const videoUrlMatch = triggerContent.match(/URL: (.+)/)
                const videoUrl = automation.type === 'youtube' ? videoUrlMatch?.[1]?.trim() : undefined
                const xThreadPrompt = (config.xThreadPrompt as string) || undefined
                threadUrl = await generateAndPostThread(article.id, article.title, article.slug, videoUrl, xThreadPrompt)
            } catch (e: any) {
                xPostError = e.message
                console.error('[runAutomation] X post failed:', e)
            }
        }

        if (outputMode === 'article_and_x_post' && article) {
            try {
                const videoUrlMatch = triggerContent.match(/URL: (.+)/)
                const videoUrl = automation.type === 'youtube' ? videoUrlMatch?.[1]?.trim() : undefined
                const xThreadPrompt = (config.xThreadPrompt as string) || undefined
                threadUrl = await generateAndPostSingle(article.id, article.title, article.slug, videoUrl, xThreadPrompt)
            } catch (e: any) {
                xPostError = e.message
                console.error('[runAutomation] X single post failed:', e)
            }
        }

        const result = { success: true, articleId, threadUrl, xPostError }
        await db.update(automations)
            .set({ lastRunAt: new Date(), lastResult: result })
            .where(eq(automations.id, automation.id))
        return result

    } catch (error) {
        console.error('[runAutomation] Error:', error)
        const message = error instanceof Error ? error.message : String(error)
        const result = { success: false, error: message }
        await db.update(automations)
            .set({ lastRunAt: new Date(), lastResult: result })
            .where(eq(automations.id, automation.id))
        return result
    }
}

// --- Webhook handler (YouTube push notification) ---
export async function processYouTubeVideo(
    video: { title: string; link: string; pubDate?: string; description: string },
    automation: Automation
) {
    console.log(`[processYouTubeVideo] Processing video: ${video.title}`)

    try {
        const config = automation.config as Record<string, unknown>
        const outputMode = (config.outputMode as string) || 'article_and_x'

        // 1. Fetch transcript (fast, ~10-20s)
        const transcript = await fetchTranscript(video.link)
        const transcriptSection = transcript
            ? `\nTranscript (${transcript.split(/\s+/).length} words):\n${transcript}`
            : '\n[No transcript available — use search_web to find coverage of this video]'

        const triggerData = `Video Title: ${video.title}\nURL: ${video.link}\nPublished: ${video.pubDate}\nDescription: ${video.description}${transcriptSection}`

        // 2. Handle x_only mode (immediate link post, no AI)
        if (outputMode === 'x_only') {
            let threadUrl: string | undefined
            let xPostError: string | undefined
            try {
                threadUrl = await postXLink(video.title, video.link, video.description)
            } catch (e: any) {
                xPostError = e.message
            }
            const result = { success: !xPostError, threadUrl, xPostError }
            await db.update(automations).set({ lastRunAt: new Date(), lastResult: result }).where(eq(automations.id, automation.id))
            return result
        }

        // 3. Generate Article (AI involved, ~30-40s)
        console.log(`[processYouTubeVideo] Writing article for: ${video.title}`)
        const { success, articleId, error } = await generateArticle(triggerData, automation)

        if (!success || !articleId) {
            const result = { success: false, error: error || 'Failed to generate article' }
            await db.update(automations).set({ lastRunAt: new Date(), lastResult: result }).where(eq(automations.id, automation.id))
            return result
        }
        const article = await db.query.articles.findFirst({ where: eq(articles.id, articleId) })

        // 4. Trigger automated clipping ASYNC if enabled
        const videoClippingEnabled = config.videoClippingEnabled === true
        if (videoClippingEnabled && article && (outputMode === 'article_and_x' || outputMode === 'article_and_x_post')) {
            try {
                console.log(`[processYouTubeVideo] Triggering async clipping for: ${video.title}`)
                const [clipRecord] = await db.insert(videoClips).values({
                    youtubeUrl: video.link,
                    videoTitle: video.title,
                    status: 'queued',
                    automationId: automation.id
                }).returning()

                if (clipRecord) {
                    // Start clipping in background. Webhook will handle the X post when done.
                    triggerClippingJob(clipRecord.id, video.link, articleId, automation.id)
                        .catch(e => console.error(`[processYouTubeVideo] Background clipping trigger failed:`, e.message))

                    const result = { success: true, articleId, status: 'clipping_in_progress' }
                    await db.update(automations).set({ lastRunAt: new Date(), lastResult: result }).where(eq(automations.id, automation.id))
                    return result
                }
            } catch (e: any) {
                console.warn(`[processYouTubeVideo] Automated clipping trigger failed (non-fatal): ${e.message}`)
            }
        }

        // 5. Fallback Social Posting (if no clipping enabled or if it's article_only)
        let threadUrl: string | undefined
        let xPostError: string | undefined

        if (outputMode === 'article_and_x' && article) {
            try {
                const xThreadPrompt = (config.xThreadPrompt as string) || undefined
                threadUrl = await generateAndPostThread(article.id, article.title, article.slug, video.link, xThreadPrompt)
            } catch (e: any) {
                xPostError = e.message
            }
        }

        if (outputMode === 'article_and_x_post' && article) {
            try {
                const xThreadPrompt = (config.xThreadPrompt as string) || undefined
                threadUrl = await generateAndPostSingle(article.id, article.title, article.slug, video.link, xThreadPrompt)
            } catch (e: any) {
                xPostError = e.message
            }
        }

        const result = { success: true, articleId, threadUrl, xPostError }
        await db.update(automations).set({ lastRunAt: new Date(), lastResult: result }).where(eq(automations.id, automation.id))
        return result

    } catch (error: any) {
        console.error('[processYouTubeVideo] Fatal Error:', error)
        const result = { success: false, error: error.message }
        await db.update(automations).set({ lastRunAt: new Date(), lastResult: result }).where(eq(automations.id, automation.id))
        return result
    }
}

// --- Trigger checker (cron/polling fallback) ---
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

                // Find first English video (skip non-English ones)
                let latest = null
                for (const item of newItems) {
                    const videoUrl = item.link || ''
                    const transcript = await fetchTranscript(videoUrl)

                    // Check if video is in English (use transcript if available, otherwise title + description)
                    const contentToCheck = transcript || (item.title || '') + ' ' + (item.contentSnippet || '')
                    if (isEnglish(contentToCheck)) {
                        latest = { item, videoUrl, transcript }
                        break
                    } else {
                        console.log(`[checkTrigger] Skipping non-English video: ${item.title}`)
                    }
                }

                if (!latest) {
                    console.log('[checkTrigger] No English videos found in latest items')
                    return null
                }

                const transcriptSection = latest.transcript
                    ? `\nTranscript (${latest.transcript.split(/\s+/).length} words):\n${latest.transcript}`
                    : '\n[No transcript available — use search_web to find coverage of this video]'

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
