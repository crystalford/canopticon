import { generateText, stepCountIs } from 'ai'
import { chatModel } from '@/lib/ai/providers'
import { createTools } from '@/lib/ai/tools'
import { searchPerplexity } from '@/lib/ai/tools'
import { db, automations } from '@/db'
import { eq } from 'drizzle-orm'
import RSSParser from 'rss-parser'
import type { Automation } from '@/db/schema'

const parser = new RSSParser()

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

        // Update automation record
        await db.update(automations).set({
            lastRunAt: new Date(),
            lastResult: {
                success: true,
                summary: result.text?.substring(0, 300) || 'Article generated',
                timestamp: new Date().toISOString(),
            },
            updatedAt: new Date(),
        }).where(eq(automations.id, automation.id))

        console.log(`[runner] Completed: ${automation.name}`)
        return { success: true, text: result.text }
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
                const feed = await parser.parseURL(feedUrl)
                console.log(`[runner] Feed returned ${feed.items.length} items`)

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
                console.error(`[runner] RSS feed fetch failed for ${feedUrl}:`, error)
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
