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
    const prompt = `Convert this article into an engaging Twitter thread (5-7 tweets). Each tweet must be under 280 characters.

Article Title: ${articleTitle}
Article Summary: ${article.summary}
Article Content (first 2000 chars): ${article.content.substring(0, 2000)}

Instructions:
- Tweet 1: Hook - grab attention with the key insight
- Tweets 2-5: Main points from the article, one per tweet
- Last tweet: "Read the full analysis: ${articleUrl}"
- Each tweet MUST be under 280 characters
- Write in a professional, engaging tone
- Use line breaks for readability

Return ONLY a JSON array of tweet strings, nothing else. Example format:
["Tweet 1 text here", "Tweet 2 text here", "Tweet 3 text here"]`

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


export async function runAutomation(automation: Automation) {
    console.log(`[runner] Running automation: ${automation.name} (${automation.type})`)

    try {
        // Check for new content based on type
        const triggerData = await checkTrigger(automation)
        if (!triggerData) {
            const config = automation.config as Record<string, unknown>
            const reason = automation.type === 'youtube' && !config.channelId
                ? 'Missing channelId in config'
                : automation.type === 'rss' && !config.feedUrl
                    ? 'Missing feedUrl in config'
                    : automation.type === 'keyword' && !(config.keywords as string[])?.length
                        ? 'Missing keywords in config'
                        : 'No new content found'
            console.log(`[runner] Skipped ${automation.name}: ${reason}`)
            await db.update(automations).set({
                lastRunAt: new Date(),
                lastResult: { skipped: true, reason },
                updatedAt: new Date(),
            }).where(eq(automations.id, automation.id))
            return { skipped: true, reason }
        }

        console.log(`[runner] New content found, generating article for: ${automation.name}`)

        // Build the prompt
        const instructions = automation.prompt || 'Write a news article about this content.'
        const publishMode = 'Publish the article using the publish_article tool.'
            + (automation.autoPublish ? '' : ' The article will be saved as a draft for review.')
        const fullPrompt = `${instructions}\n\n${publishMode}\n\nNew content detected:\n${triggerData}`

        // Generate article using Claude with tools
        const tools = createTools(undefined, { saveDraft: !automation.autoPublish })
        const result = await generateText({
            model: chatModel,
            system: 'You are Canopticon, an automated publishing system. When given new content and instructions, research the topic if needed (limit to 2 searches max), then write a thorough article, and ALWAYS publish it using the publish_article tool. You MUST call publish_article before finishing. Write like a professional journalist. For YouTube video content, embed the video in the article using this format: `<youtube>VIDEO_ID</youtube>` (extract the video ID from the URL, e.g. for https://www.youtube.com/watch?v=abc123 use `<youtube>abc123</youtube>`). Place the embed near the top of the article.',
            prompt: fullPrompt,
            tools,
            stopWhen: stepCountIs(10),
        })

        // Extract article ID from tool invocations
        let articleId: string | undefined
        let articleTitle: string | undefined
        let articleSlug: string | undefined

        // Look through tool results for publish_article call
        if (result.toolResults) {
            for (const toolResult of result.toolResults) {
                if (toolResult.toolName === 'publish_article' && toolResult.output) {
                    const resultData = toolResult.output as any
                    if (resultData.success && resultData.article) {
                        articleId = resultData.article.id
                        articleTitle = resultData.article.title
                        articleSlug = resultData.article.slug
                        break
                    }
                }
            }
        }

        // Auto-post to X if enabled and article was created
        const config = automation.config as Record<string, unknown>
        let threadUrl: string | undefined
        let xPostError: string | undefined

        if (articleId && articleSlug && config.autoPostToX === true) {
            console.log(`[runner] ===== AUTO-POST TO X =====`)
            console.log(`[runner] Article ID: ${articleId}`)
            console.log(`[runner] Article Title: ${articleTitle}`)
            console.log(`[runner] Article Slug: ${articleSlug}`)
            console.log(`[runner] Attempting to generate and post thread...`)

            try {
                threadUrl = await generateAndPostThread(articleId, articleTitle!, articleSlug)
                console.log(`[runner] ===== THREAD POSTED SUCCESSFULLY =====`)
                console.log(`[runner] Thread URL: ${threadUrl}`)
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error)
                xPostError = message
                console.error(`[runner] ===== X POSTING FAILED =====`)
                console.error(`[runner] Error:`, message)
                console.error(`[runner] Full error:`, error)
                // Don't fail the whole automation if X posting fails
            }
        }

        // Update automation record
        await db.update(automations).set({
            lastRunAt: new Date(),
            lastResult: {
                success: true,
                summary: result.text?.substring(0, 300) || 'Article generated',
                timestamp: new Date().toISOString(),
                articleId,
                articleSlug,
                threadUrl,
                xPostError,
            },
            updatedAt: new Date(),
        }).where(eq(automations.id, automation.id))

        console.log(`[runner] Completed: ${automation.name}`)
        return { success: true, text: result.text, articleId, threadUrl }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(`[runner] Error for ${automation.name}:`, message)

        await db.update(automations).set({
            lastRunAt: new Date(),
            lastResult: { success: false, error: message },
            updatedAt: new Date(),
        }).where(eq(automations.id, automation.id))

        return { success: false, error: message }
    }
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
