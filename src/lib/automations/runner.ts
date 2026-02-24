import { generateText, stepCountIs } from 'ai'
import { getModel } from '@/lib/ai/providers'
import { createTools } from '@/lib/ai/tools'
import { searchPerplexity } from '@/lib/ai/tools'
import { db, automations, articles } from '@/db'
import { eq } from 'drizzle-orm'
import RSSParser from 'rss-parser'
import type { Automation } from '@/db/schema'
import { TwitterApi } from 'twitter-api-v2'

const parser = new RSSParser()

// --- Default model config ---
// These can be overridden per-automation via config.researchModel / config.writingModel
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
6. ALWAYS use the publish_article tool to save the article when done.`

// --- Helper: post X/Twitter thread ---
async function generateAndPostThread(
    articleId: string,
    articleTitle: string,
    articleSlug: string
): Promise<string> {
    console.log(`[generateAndPostThread] Generating thread for: ${articleTitle}`)

    const apiKey = process.env.TWITTER_API_KEY
    const apiSecret = process.env.TWITTER_API_SECRET
    const accessToken = process.env.TWITTER_ACCESS_TOKEN
    const accessSecret = process.env.TWITTER_ACCESS_SECRET

    if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
        throw new Error('X/Twitter API credentials not configured')
    }

    const article = await db.query.articles.findFirst({
        where: eq(articles.id, articleId),
    })
    if (!article) throw new Error('Article not found')

    const articleUrl = `https://canopticon.com/articles/${articleSlug}`
    const wordCount = article.content.split(/\s+/).length
    const threadLength = wordCount < 500 ? '3-4' : wordCount < 1500 ? '5-7' : '7-8'
    const urlReservedSpace = articleUrl.length + 25
    const maxLastTweetContentLength = 280 - urlReservedSpace

    const prompt = `Convert this article into an engaging Twitter thread (${threadLength} tweets). Each tweet must be under 280 characters.

Article Title: ${articleTitle}
Article Summary: ${article.summary}
Article Content (first 2000 chars): ${article.content.substring(0, 2000)}

Instructions:
- Tweet 1: Hook — grab attention with the key insight
- Middle tweets: Main points, one per tweet
- Last tweet: MUST include this exact text at the end: "Read the full analysis: ${articleUrl}"
- CRITICAL: Last tweet content BEFORE the URL must be ${maxLastTweetContentLength} characters or less
- Each tweet MUST be under 280 characters total
- Return ONLY a JSON array of tweet strings.`

    const chatModel = await getModel(DEFAULT_RESEARCH_PROVIDER, DEFAULT_RESEARCH_MODEL)
    const result = await generateText({ model: chatModel, prompt })

    let tweets: string[]
    try {
        const jsonMatch = result.text.match(/\[[\s\S]*\]/)
        if (!jsonMatch) throw new Error('No JSON array found')
        tweets = JSON.parse(jsonMatch[0])
        if (!Array.isArray(tweets)) throw new Error('Invalid format')
    } catch (error) {
        throw new Error(`Failed to parse thread: ${error}`)
    }

    const client = new TwitterApi({ appKey: apiKey, appSecret: apiSecret, accessToken, accessSecret })
    let lastTweetId: string | undefined
    const postedTweets: { id: string; text: string }[] = []

    for (const text of tweets) {
        const params: any = { text }
        if (lastTweetId) params.reply = { in_reply_to_tweet_id: lastTweetId }
        const tweetResult = await client.v2.tweet(params)
        lastTweetId = tweetResult.data.id
        postedTweets.push({ id: tweetResult.data.id, text })
    }

    return `https://x.com/i/status/${postedTweets[0].id}`
}

// --- Core article generation (used by all pipeline types) ---
async function generateArticle(
    triggerContent: string,
    automationConfig: any
): Promise<{ success: boolean; articleId?: string; error?: string }> {

    const instructions = automationConfig.prompt || 'Write a news article about this content.'
    const publishMode = automationConfig.autoPublish
        ? 'Publish the article using the publish_article tool.'
        : 'Save the article as a draft using the publish_article tool with status=draft.'

    const fullPrompt = `${instructions}\n\n${publishMode}\n\nNew content detected:\n${triggerContent}`

    const tools = createTools(undefined, { saveDraft: !automationConfig.autoPublish })

    // Use config-specified models, falling back to defaults
    const researchProvider = automationConfig.config?.researchProvider || DEFAULT_RESEARCH_PROVIDER
    const researchModelId = automationConfig.config?.researchModel || DEFAULT_RESEARCH_MODEL
    const writingProvider = automationConfig.config?.writingProvider || DEFAULT_WRITING_PROVIDER
    const writingModelId = automationConfig.config?.writingModel || DEFAULT_WRITING_MODEL

    console.log(`[generateArticle] Research: ${researchProvider}/${researchModelId} | Writing: ${writingProvider}/${writingModelId}`)

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
        where: (articles, { gte }) => gte(articles.createdAt, new Date(Date.now() - 60000)),
        orderBy: (articles, { desc }) => [desc(articles.createdAt)],
    })

    if (recentArticle) {
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

    const triggerContent = await checkTrigger(automation)
    const config = automation.config as Record<string, unknown>

    if (!triggerContent) {
        const result = { success: true, skipped: true, reason: 'No new content found' }
        await db.update(automations)
            .set({ lastRunAt: new Date(), lastResult: result })
            .where(eq(automations.id, automation.id))
        return result
    }

    try {
        const { success, articleId, error } = await generateArticle(triggerContent, {
            ...automation,
            config, // pass full config for model overrides
        })

        if (!success) {
            const result = { success: false, error: error || 'Unknown error' }
            await db.update(automations)
                .set({ lastRunAt: new Date(), lastResult: result })
                .where(eq(automations.id, automation.id))
            return result
        }

        // Get article details for X posting
        const article = articleId ? await db.query.articles.findFirst({
            where: eq(articles.id, articleId),
        }) : null

        let threadUrl: string | undefined
        let xPostError: string | undefined

        if (config.autoPostToX === true && article) {
            try {
                threadUrl = await generateAndPostThread(article.id, article.title, article.slug)
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

// --- Webhook handler (YouTube push notifications) ---
export async function processYouTubeVideo(
    video: { title: string; link: string; pubDate?: string; description: string },
    automationConfig: any = {}
) {
    console.log(`[processYouTubeVideo] Processing video: ${video.title}`)

    const triggerData = `Video Title: ${video.title}\nURL: ${video.link}\nPublished: ${video.pubDate}\nDescription: ${video.description}`

    const { success, articleId, error } = await generateArticle(triggerData, automationConfig)

    if (!success) return { success: false, error }

    const article = articleId ? await db.query.articles.findFirst({
        where: eq(articles.id, articleId),
    }) : null

    if (article && automationConfig.autoPostToX === true) {
        try {
            const threadUrl = await generateAndPostThread(article.id, article.title, article.slug)
            return { success: true, articleId, threadUrl }
        } catch (err: any) {
            return { success: true, articleId, xPostError: err.message }
        }
    }

    return { success: true, articleId }
}

// --- Trigger checker (cron/manual polling) ---
async function checkTrigger(automation: Automation): Promise<string | null> {
    const lastRun = automation.lastRunAt ? new Date(automation.lastRunAt) : new Date(0)
    const config = automation.config as Record<string, unknown>

    switch (automation.type) {
        case 'youtube': {
            const channelId = config.channelId as string
            if (!channelId) return null
            const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
            console.log(`[checkTrigger] Fetching RSS: ${feedUrl}`)
            try {
                const feed = await parser.parseURL(feedUrl)
                const newItems = feed.items.filter(item => {
                    const pubDate = item.pubDate ? new Date(item.pubDate) : new Date(0)
                    return pubDate > lastRun
                })
                console.log(`[checkTrigger] ${newItems.length} new videos since ${lastRun.toISOString()}`)
                if (newItems.length === 0) return null
                // Only process the latest video — aggregating multiple causes generic summaries
                const latest = newItems[0]
                return `Video Title: ${latest.title}\nURL: ${latest.link}\nPublished: ${latest.pubDate}\nDescription: ${latest.contentSnippet || ''}`
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
                const query = keywords.join(' OR ') + ' latest news'
                return await searchPerplexity(query)
            } catch (e) {
                console.error('[checkTrigger] Keyword Error:', e)
                return null
            }
        }
        default:
            return null
    }
}
