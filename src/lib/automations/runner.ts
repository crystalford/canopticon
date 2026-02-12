import { generateText, stepCountIs } from 'ai'
import { getChatModel } from '@/lib/ai/providers'
import { createTools } from '@/lib/ai/tools'
import { searchPerplexity } from '@/lib/ai/tools'
import { db, automations, articles } from '@/db'
import { eq } from 'drizzle-orm'
import RSSParser from 'rss-parser'
import type { Automation } from '@/db/schema'
import { TwitterApi } from 'twitter-api-v2'

const parser = new RSSParser()

// --- Helper Functions ---

async function generateAndPostThread(articleId: string, articleTitle: string, articleSlug: string): Promise<string> {
    console.log(`[generateAndPostThread] Generating thread for article: ${articleTitle}`)

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

    if (!article) {
        throw new Error('Article not found')
    }

    const articleUrl = `https://canopticon.com/articles/${articleSlug}`
    const wordCount = article.content.split(/\s+/).length
    let threadLength = wordCount < 500 ? '3-4' : wordCount < 1500 ? '5-7' : '7-8'
    const urlReservedSpace = articleUrl.length + 25
    const maxLastTweetContentLength = 280 - urlReservedSpace

    const prompt = `Convert this article into an engaging Twitter thread (${threadLength} tweets). Each tweet must be under 280 characters.

Article Title: ${articleTitle}
Article Summary: ${article.summary}
Article Content (first 2000 chars): ${article.content.substring(0, 2000)}

Instructions:
- Tweet 1: Hook - grab attention with the key insight  
- Middle tweets: Main points from the article, one per tweet
- Last tweet: MUST include this exact text at the end: "Read the full analysis: ${articleUrl}"
- CRITICAL: The last tweet content BEFORE the URL must be ${maxLastTweetContentLength} characters or less to fit the URL
- Each tweet MUST be under 280 characters total
- Return ONLY a JSON array of tweet strings.
`


    const chatModel = await getChatModel()
    const result = await generateText({
        model: chatModel,
        prompt,
    })

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

export async function processYouTubeVideo(video: { title: string, link: string, pubDate?: string, description: string }, automationConfig: any = {}) {
    console.log(`[processYouTubeVideo] Processing video: ${video.title}`)

    const instructions = automationConfig.prompt || 'Write a news article about this content.'
    const publishMode = 'Publish the article using the publish_article tool.' + (automationConfig.autoPublish ? '' : ' The article will be saved as a draft for review.')
    const triggerData = `Video Title: ${video.title}\nURL: ${video.link}\nPublished: ${video.pubDate}\nDescription: ${video.description}`
    const fullPrompt = `${instructions}\n\n${publishMode}\n\nNew content detected:\n${triggerData}`

    const tools = createTools(undefined, { saveDraft: !automationConfig.autoPublish })
    const chatModel = await getChatModel()
    const result = await generateText({
        model: chatModel,
        system: 'You are Canopticon, an automated publishing system. Write a thorough article and ALWAYS publish it using the publish_article tool. Embed YouTube videos using <youtube>ID</youtube>.',
        prompt: fullPrompt,
        tools,
        stopWhen: stepCountIs(10),
    })

    const recentArticle = await db.query.articles.findFirst({
        where: (articles, { gte }) => gte(articles.createdAt, new Date(Date.now() - 30000)),
        orderBy: (articles, { desc }) => [desc(articles.createdAt)],
    })

    if (recentArticle) {
        if (automationConfig.autoPostToX === true) {
            try {
                const threadUrl = await generateAndPostThread(recentArticle.id, recentArticle.title, recentArticle.slug)
                return { success: true, articleId: recentArticle.id, summary: result.text, threadUrl }
            } catch (err: any) {
                return { success: true, articleId: recentArticle.id, summary: result.text, xPostError: err.message }
            }
        }
        return { success: true, articleId: recentArticle.id, summary: result.text }
    }

    return { success: false, error: "No article created" }
}

// --- Main Runner Function ---

export async function runAutomation(automation: Automation): Promise<{ success: boolean; error?: string; skipped?: boolean; reason?: string; articleId?: string }> {
    console.log(`[runAutomation] Running automation: ${automation.name} (${automation.type})`)

    const triggerContent = await checkTrigger(automation)

    if (!triggerContent) {
        await db.update(automations).set({ lastRunAt: new Date() }).where(eq(automations.id, automation.id))
        return { success: true, skipped: true, reason: 'No new content found' }
    }

    const config = automation.config as Record<string, unknown>
    const instructions = automation.prompt || 'Write a news article about this content.'
    const publishMode = 'Publish the article using the publish_article tool.' + (automation.autoPublish ? '' : ' The article will be saved as a draft for review.')
    const fullPrompt = `${instructions}\n\n${publishMode}\n\nNew content detected:\n${triggerContent}`

    try {
        const tools = createTools(undefined, { saveDraft: !automation.autoPublish })
        const chatModel = await getChatModel()
        await generateText({
            model: chatModel,
            system: 'You are Canopticon, an automated publishing system. Write a thorough article and ALWAYS publish it using the publish_article tool.',
            prompt: fullPrompt,
            tools,
            stopWhen: stepCountIs(10),
        })

        const recentArticle = await db.query.articles.findFirst({
            where: (articles, { gte }) => gte(articles.createdAt, new Date(Date.now() - 60000)),
            orderBy: (articles, { desc }) => [desc(articles.createdAt)],
        })

        if (recentArticle) {
            await db.update(automations).set({ lastRunAt: new Date() }).where(eq(automations.id, automation.id))

            if (config.autoPostToX === true) {
                try {
                    await generateAndPostThread(recentArticle.id, recentArticle.title, recentArticle.slug)
                } catch (e) {
                    console.error("Auto post to X failed", e)
                }
            }

            return { success: true, articleId: recentArticle.id }
        }

        return { success: false, error: "AI ran but no article was created." }

    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { success: false, error: message }
    }
}

async function checkTrigger(automation: Automation): Promise<string | null> {
    const lastRun = automation.lastRunAt ? new Date(automation.lastRunAt) : new Date(0)
    const config = automation.config as Record<string, unknown>

    switch (automation.type) {
        case 'youtube': {
            // Fallback for polling if webhook not used
            const channelId = config.channelId as string
            if (!channelId) return null
            const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
            console.log(`[checkTrigger] Fetching RSS: ${feedUrl}`)
            try {
                const feed = await parser.parseURL(feedUrl)
                console.log(`[checkTrigger] Feeds fetched: ${feed.items.length} items. LastRun: ${lastRun.toISOString()}`)

                const newItems = feed.items.filter(item => {
                    const pubDate = item.pubDate ? new Date(item.pubDate) : new Date(0)
                    const isNew = pubDate > lastRun
                    // console.log(`- Video: ${item.title} (${pubDate.toISOString()}) > ${lastRun.toISOString()}? ${isNew}`)
                    return isNew
                })
                console.log(`[checkTrigger] Found ${newItems.length} new items.`)

                if (newItems.length === 0) return null
                return newItems.slice(0, 3).map(item => `Video: ${item.title} (${item.link})`).join('\n')
            } catch (e) {
                console.error('[checkTrigger] RSS Error:', e);
                return null
            }
        }
        case 'rss': {
            const feedUrl = config.feedUrl as string
            if (!feedUrl) return null
            try {
                const feed = await parser.parseURL(feedUrl) // Logic simplified for brevity, assume valid RSS
                const newItems = feed.items.filter(item => {
                    const pubDate = item.pubDate ? new Date(item.pubDate) : new Date(0)
                    return pubDate > lastRun
                })
                if (newItems.length === 0) return null
                return newItems.slice(0, 5).map(item => `Title: ${item.title}\nLink: ${item.link}\nSummary: ${item.contentSnippet}`).join('\n---\n')
            } catch (e) { console.error(e); return null }
        }
        case 'keyword': {
            const keywords = config.keywords as string[]
            if (!keywords?.length) return null
            try {
                const query = keywords.join(' OR ') + ' latest news'
                return await searchPerplexity(query)
            } catch (e) { console.error(e); return null }
        }
        default: return null
    }
}
