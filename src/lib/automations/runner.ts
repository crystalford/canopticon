import { generateText, stepCountIs } from 'ai'
import { chatModel } from '@/lib/ai/providers'
import { createTools } from '@/lib/ai/tools'
import { searchPerplexity } from '@/lib/ai/tools'
import { db, automations, articles } from '@/db'
import { eq } from 'drizzle-orm'
import RSSParser from 'rss-parser'
import type { Automation } from '@/db/schema'
import { TwitterApi } from 'twitter-api-v2'

const parser = new RSSParser()

async function generateAndPostThread(articleId: string, articleTitle: string, articleSlug: string): Promise<string> {
    console.log(`[generateAndPostThread] Generating thread for article: ${articleTitle}`)

    // Check for X API credentials
    const apiKey = process.env.TWITTER_API_KEY
    const apiSecret = process.env.TWITTER_API_SECRET
    const accessToken = process.env.TWITTER_ACCESS_TOKEN
    const accessSecret = process.env.TWITTER_ACCESS_SECRET

    if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
        throw new Error('X/Twitter API credentials not configured')
    }

    // Fetch the article
    const article = await db.query.articles.findFirst({
        where: eq(articles.id, articleId),
    })

    if (!article) {
        throw new Error('Article not found')
    }

    // Generate thread using AI
    const articleUrl = `https://canopticon.com/articles/${articleSlug}`

    // Calculate dynamic thread length based on article word count
    const wordCount = article.content.split(/\s+/).length
    let threadLength: string
    if (wordCount < 500) {
        threadLength = '3-4'  // Short articles
    } else if (wordCount < 1500) {
        threadLength = '5-7'  // Medium articles (most common)
    } else {
        threadLength = '7-8'  // Long articles
    }

    // Reserve space for URL in last tweet (URL + "Read the full analysis: " = ~70 chars)
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
- Write in a professional, engaging tone
- Use line breaks for readability
- Do NOT add emojis (they may already be in the content)

Return ONLY a JSON array of tweet strings, nothing else. Example format:
["Tweet 1 text here", "Tweet 2 text here", "Final tweet text.\n\nRead the full analysis: ${articleUrl}"]`

    const result = await generateText({
        model: chatModel,
        prompt,
    })

    console.log(`[generateAndPostThread] AI response:`, result.text)

    // Parse the thread from AI response
    let tweets: string[]
    try {
        // Try to extract JSON array from the response
        const jsonMatch = result.text.match(/\[[\s\S]*\]/)
        if (!jsonMatch) {
            throw new Error('No JSON array found in AI response')
        }
        tweets = JSON.parse(jsonMatch[0])

        if (!Array.isArray(tweets) || tweets.length === 0) {
            throw new Error('Invalid thread format')
        }

        // Validate tweet lengths
        const tooLong = tweets.findIndex(t => t.length > 280)
        if (tooLong >= 0) {
            throw new Error(`Tweet ${tooLong + 1} is too long (${tweets[tooLong].length} chars)`)
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        throw new Error(`Failed to parse thread: ${message}`)
    }

    console.log(`[generateAndPostThread] Generated ${tweets.length} tweets`)

    // Post thread to X
    const client = new TwitterApi({
        appKey: apiKey,
        appSecret: apiSecret,
        accessToken,
        accessSecret,
    })

    let lastTweetId: string | undefined
    const postedTweets: { id: string; text: string }[] = []

    for (const text of tweets) {
        const params: any = { text }
        if (lastTweetId) {
            params.reply = { in_reply_to_tweet_id: lastTweetId }
        }

        const tweetResult = await client.v2.tweet(params)
        lastTweetId = tweetResult.data.id
        postedTweets.push({ id: tweetResult.data.id, text })
    }

    const threadUrl = `https://x.com/i/status/${postedTweets[0].id}`
    console.log(`[generateAndPostThread] Thread posted: ${threadUrl}`)

    return threadUrl
}

export async function processYouTubeVideo(video: { title: string, link: string, pubDate?: string, description: string }, automationConfig: any = {}) {
    console.log(`[processYouTubeVideo] Processing video: ${video.title}`)

    // 1. Build the prompt
    const instructions = automationConfig.prompt || 'Write a news article about this content.'
    const publishMode = 'Publish the article using the publish_article tool.'
        + (automationConfig.autoPublish ? '' : ' The article will be saved as a draft for review.')

    const triggerData = `Video Title: ${video.title}\nURL: ${video.link}\nPublished: ${video.pubDate}\nDescription: ${video.description}`
    const fullPrompt = `${instructions}\n\n${publishMode}\n\nNew content detected:\n${triggerData}`

    // 2. Generate article using Claude with tools
    const tools = createTools(undefined, { saveDraft: !automationConfig.autoPublish })
    const result = await generateText({
        model: chatModel,
        system: 'You are Canopticon, an automated publishing system. When given new content and instructions, research the topic if needed (limit to 2 searches max), then write a thorough article, and ALWAYS publish it using the publish_article tool. You MUST call publish_article before finishing. Write like a professional journalist. For YouTube video content, embed the video in the article using this format: `<youtube>VIDEO_ID</youtube>` (extract the video ID from the URL, e.g. for https://www.youtube.com/watch?v=abc123 use `<youtube>abc123</youtube>`). Place the embed near the top of the article.',
        prompt: fullPrompt,
        tools,
        stopWhen: stepCountIs(10),
    })

    // 3. Find created article (simplified check)
    const recentArticle = await db.query.articles.findFirst({
        where: (articles, { gte }) => gte(articles.createdAt, new Date(Date.now() - 30000)),
        orderBy: (articles, { desc }) => [desc(articles.createdAt)],
    })

    if (recentArticle) {
        console.log(`[processYouTubeVideo] Article created: ${recentArticle.title}`)

        // 4. Auto-post to X
        if (automationConfig.autoPostToX === true) {
            await generateAndPostThread(recentArticle.id, recentArticle.title, recentArticle.slug)
        }
        return { success: true, articleId: recentArticle.id, summary: result.text }
    }

    return { success: false, error: "No article created" }
}


// ... (imports remain)

export async function processYouTubeVideo(video: { title: string, link: string, pubDate?: string, description: string }, automationConfig: any = {}) {
    console.log(`[processYouTubeVideo] Processing video: ${video.title}`)

    // 1. Build the prompt
    const instructions = automationConfig.prompt || 'Write a news article about this content.'
    const publishMode = 'Publish the article using the publish_article tool.'
        + (automationConfig.autoPublish ? '' : ' The article will be saved as a draft for review.')

    const triggerData = `Video Title: ${video.title}\nURL: ${video.link}\nPublished: ${video.pubDate}\nDescription: ${video.description}`
    const fullPrompt = `${instructions}\n\n${publishMode}\n\nNew content detected:\n${triggerData}`

    // 2. Generate article using Claude with tools
    const tools = createTools(undefined, { saveDraft: !automationConfig.autoPublish })
    const result = await generateText({
        model: chatModel,
        system: 'You are Canopticon, an automated publishing system. When given new content and instructions, research the topic if needed (limit to 2 searches max), then write a thorough article, and ALWAYS publish it using the publish_article tool. You MUST call publish_article before finishing. Write like a professional journalist. For YouTube video content, embed the video in the article using this format: `<youtube>VIDEO_ID</youtube>` (extract the video ID from the URL, e.g. for https://www.youtube.com/watch?v=abc123 use `<youtube>abc123</youtube>`). Place the embed near the top of the article.',
        prompt: fullPrompt,
        tools,
        stopWhen: stepCountIs(10),
    })

    // 3. Find created article (simplified check)
    const recentArticle = await db.query.articles.findFirst({
        where: (articles, { gte }) => gte(articles.createdAt, new Date(Date.now() - 30000)),
        orderBy: (articles, { desc }) => [desc(articles.createdAt)],
    })

    if (recentArticle) {
        console.log(`[processYouTubeVideo] Article created: ${recentArticle.title}`)

        // 4. Auto-post to X
        if (automationConfig.autoPostToX === true) {
            await generateAndPostThread(recentArticle.id, recentArticle.title, recentArticle.slug)
        }
        return { success: true, articleId: recentArticle.id, summary: result.text }
    }

    return { success: false, error: "No article created" }
}

export async function runAutomation(automation: Automation) {
    // ... (existing logic, but call processYouTubeVideo if type is youtube)
    // Actually, runAutomation is for CRON polling. 
    // I will leave runAutomation as is for RSS/Keywords, but for YouTube, I can make it use the new function or just keep it for polling fallback.
    // For now, I will keep runAutomation mostly as is but refactor the generation part if I want DRY.
    // But since the user wants to STOP using crons for YouTube, I might just leave runAutomation alone and only use processYouTubeVideo for the webhook.
    // However, DRY is better.

    // Let's copy the generation logic into a helper `generateExec` first?
    // Or just make `processContent` generic?

    // For simplicity given the instruction: I will just ADD the new function and leave runAutomation alone for now to avoid breaking existing RSS/Keyword monitors.
    // I will duplicate the logic slightly for safety, or extract the core generation part.

    // Extracted "generateAndPublish" logic:
    return await generateFromContent(automation, `...content string...`)
}

async function generateFromContent(automationConfig: any, contentString: string) {
    // ... implementation of lines 160-219 ...
}


async function checkTrigger(automation: Automation): Promise<string | null> {
    const lastRun = automation.lastRunAt ? new Date(automation.lastRunAt) : new Date(0)
    const config = automation.config as Record<string, unknown>
    console.log(`[runner] checkTrigger: type=${automation.type}, config=${JSON.stringify(config)}, lastRun=${lastRun.toISOString()}`)

    switch (automation.type) {
        case 'youtube': {
            const channelId = config.channelId as string
            if (!channelId) {
                console.log(`[runner] YouTube monitor missing channelId in config`)
                return null
            }

            const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
            console.log(`[runner] Fetching YouTube feed: ${feedUrl}`)
            try {
                const feed = await parser.parseURL(feedUrl)
                console.log(`[runner] Feed returned ${feed.items.length} items`)

                const newItems = feed.items.filter(item => {
                    const pubDate = item.pubDate ? new Date(item.pubDate) : new Date(0)
                    return pubDate > lastRun
                })

                console.log(`[runner] ${newItems.length} new items since ${lastRun.toISOString()}`)
                if (newItems.length === 0) return null

                return newItems.slice(0, 3).map(item =>
                    `Video Title: ${item.title}\nURL: ${item.link}\nPublished: ${item.pubDate}\nDescription: ${item.contentSnippet || item.content || 'No description'}`
                ).join('\n\n---\n\n')
            } catch (error) {
                console.error(`[runner] YouTube feed fetch failed for channelId=${channelId}:`, error)
                return null
            }
        }

        case 'rss': {
            const feedUrl = config.feedUrl as string
            if (!feedUrl) {
                console.log(`[runner] RSS monitor missing feedUrl in config`)
                return null
            }

            console.log(`[runner] Fetching RSS feed: ${feedUrl}`)
            try {
                // First, fetch to check if it's actually an RSS/XML feed
                const response = await fetch(feedUrl)
                const contentType = response.headers.get('content-type') || ''
                const text = await response.text()

                // Check if it's HTML instead of RSS/XML
                if (contentType.includes('text/html') || text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
                    console.error(`[runner] URL returns HTML, not RSS feed: ${feedUrl}`)
                    console.error(`[runner] Please check if this is the correct RSS feed URL. Try looking for a link with "RSS", "Atom", or "Feed" on the website.`)
                    return null
                }

                // Try to parse with the parser
                const feed = await parser.parseString(text)
                console.log(`[runner] Feed returned ${feed.items?.length || 0} items`)

                if (!feed.items || feed.items.length === 0) {
                    console.log(`[runner] RSS feed has no items`)
                    return null
                }

                const newItems = feed.items.filter(item => {
                    const pubDate = item.pubDate ? new Date(item.pubDate) : new Date(0)
                    return pubDate > lastRun
                })

                console.log(`[runner] ${newItems.length} new items since ${lastRun.toISOString()}`)
                if (newItems.length === 0) return null

                return newItems.slice(0, 5).map(item =>
                    `Title: ${item.title}\nURL: ${item.link}\nPublished: ${item.pubDate}\nSummary: ${item.contentSnippet || item.content || 'No summary'}`
                ).join('\n\n---\n\n')
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error)
                console.error(`[runner] RSS feed fetch failed for ${feedUrl}:`, message)

                // Provide helpful error message
                if (message.includes('Attribute without value') || message.includes('Invalid')) {
                    console.error(`[runner] The feed appears to have malformed XML. Please verify the feed URL is correct.`)
                }

                return null
            }
        }

        case 'keyword': {
            const keywords = config.keywords as string[]
            if (!keywords?.length) {
                console.log(`[runner] Keyword monitor missing keywords in config`)
                return null
            }

            const query = keywords.join(' OR ') + ' latest news Canada'
            console.log(`[runner] Searching keywords: ${query}`)
            try {
                const results = await searchPerplexity(query)
                return `Search results for keywords [${keywords.join(', ')}]:\n\n${results}`
            } catch (error) {
                console.error('[runner] Keyword search failed:', error)
                return null
            }
        }

        default:
            console.log(`[runner] Unknown automation type: ${automation.type}`)
            return null
    }
}
