import { generateText, stepCountIs } from 'ai'
import { getModel } from '@/lib/ai/providers'
import { createTools } from '@/lib/ai/tools'
import { searchPerplexity } from '@/lib/ai/tools'
import { db, automations, articles } from '@/db'
import { eq } from 'drizzle-orm'
import RSSParser from 'rss-parser'
import type { Automation } from '@/db/schema'
import { TwitterApi } from 'twitter-api-v2'
import { fetchTranscript } from './transcript'

const parser = new RSSParser()

// Output modes:
// 'article_and_x' - write full article + post X thread (default)
// 'article_only'  - write article, no X
// 'draft'         - write article, save as draft
// 'x_only'        - skip AI entirely, just post a link tweet when new content drops

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
- The headline should tell someone who knows nothing about it what actually happened.`

// --- Helper: post X/Twitter link (x_only mode — no AI, just a link post) ---
async function postXLink(
    title: string,
    link: string,
    description?: string
): Promise<string> {
    const apiKey = process.env.TWITTER_API_KEY
    const apiSecret = process.env.TWITTER_API_SECRET
    const accessToken = process.env.TWITTER_ACCESS_TOKEN
    const accessSecret = process.env.TWITTER_ACCESS_SECRET

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
async function generateAndPostThread(
    articleId: string,
    articleTitle: string,
    articleSlug: string,
    sourceUrl?: string,       // If provided, last tweet links here instead of the article
    xThreadPrompt?: string    // Custom instructions for the thread (from config.xThreadPrompt)
): Promise<string> {
    console.log(`[generateAndPostThread] Generating thread for: ${articleTitle}`)

    const apiKey = process.env.TWITTER_API_KEY
    const apiSecret = process.env.TWITTER_API_SECRET
    const accessToken = process.env.TWITTER_ACCESS_TOKEN
    const accessSecret = process.env.TWITTER_ACCESS_SECRET

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

    // Attach YouTube thumbnail to first tweet for visual impact
    let firstTweetMediaId: string | undefined
    if (sourceUrl) {
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
                    console.log(`[generateAndPostThread] Uploaded thumbnail for ${videoId}`)
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

    const config = automation.config as Record<string, unknown>
    const outputMode = (config.outputMode as string) || 'article_and_x'

    const transcript = await fetchTranscript(video.link)
    const transcriptSection = transcript
        ? `\nTranscript (${transcript.split(/\s+/).length} words):\n${transcript}`
        : '\n[No transcript available — use search_web to find coverage of this video]'

    const triggerData = `Video Title: ${video.title}\nURL: ${video.link}\nPublished: ${video.pubDate}\nDescription: ${video.description}${transcriptSection}`

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

    const { success, articleId, error } = await generateArticle(triggerData, automation)
    if (!success) {
        const result = { success: false, error }
        await db.update(automations).set({ lastRunAt: new Date(), lastResult: result }).where(eq(automations.id, automation.id))
        return result
    }

    const article = articleId ? await db.query.articles.findFirst({ where: eq(articles.id, articleId) }) : null

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

    const result = { success: true, articleId, threadUrl, xPostError }
    await db.update(automations).set({ lastRunAt: new Date(), lastResult: result }).where(eq(automations.id, automation.id))
    return result
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
                const latest = newItems[0]
                const videoUrl = latest.link || ''

                // Fetch transcript — gives the AI the actual spoken words
                const transcript = await fetchTranscript(videoUrl)
                const transcriptSection = transcript
                    ? `\nTranscript (${transcript.split(/\s+/).length} words):\n${transcript}`
                    : '\n[No transcript available — use search_web to find coverage of this video]'

                return `Video Title: ${latest.title}\nURL: ${videoUrl}\nPublished: ${latest.pubDate}\nDescription: ${latest.contentSnippet || ''}${transcriptSection}`
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
