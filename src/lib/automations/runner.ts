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
            console.log(`[runner] No new content for: ${automation.name}`)
            await db.update(automations).set({
                lastRunAt: new Date(),
                lastResult: { skipped: true, reason: 'No new content' },
                updatedAt: new Date(),
            }).where(eq(automations.id, automation.id))
            return { skipped: true, reason: 'No new content' }
        }

        console.log(`[runner] New content found, generating article for: ${automation.name}`)

        // Build the prompt
        const instructions = automation.prompt || 'Write a news article about this content.'
        const publishMode = automation.autoPublish
            ? 'Publish the article using the publish_article tool.'
            : 'Write the article in full but do NOT publish it. Just present it for review.'
        const fullPrompt = `${instructions}\n\n${publishMode}\n\nNew content detected:\n${triggerData}`

        // Generate article using Claude with tools
        const tools = createTools()
        const result = await generateText({
            model: chatModel,
            system: 'You are Canopticon, an automated publishing system. When given new content and instructions, research further if needed using search_web, write a thorough article, and publish it if instructed. Write like a professional journalist.',
            prompt: fullPrompt,
            tools,
            stopWhen: stepCountIs(5),
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

    switch (automation.type) {
        case 'youtube': {
            const channelId = config.channelId as string
            if (!channelId) return null

            const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
            const feed = await parser.parseURL(feedUrl)

            const newItems = feed.items.filter(item => {
                const pubDate = item.pubDate ? new Date(item.pubDate) : new Date(0)
                return pubDate > lastRun
            })

            if (newItems.length === 0) return null

            return newItems.slice(0, 3).map(item =>
                `Video Title: ${item.title}\nURL: ${item.link}\nPublished: ${item.pubDate}\nDescription: ${item.contentSnippet || item.content || 'No description'}`
            ).join('\n\n---\n\n')
        }

        case 'rss': {
            const feedUrl = config.feedUrl as string
            if (!feedUrl) return null

            const feed = await parser.parseURL(feedUrl)

            const newItems = feed.items.filter(item => {
                const pubDate = item.pubDate ? new Date(item.pubDate) : new Date(0)
                return pubDate > lastRun
            })

            if (newItems.length === 0) return null

            return newItems.slice(0, 5).map(item =>
                `Title: ${item.title}\nURL: ${item.link}\nPublished: ${item.pubDate}\nSummary: ${item.contentSnippet || item.content || 'No summary'}`
            ).join('\n\n---\n\n')
        }

        case 'keyword': {
            const keywords = config.keywords as string[]
            if (!keywords?.length) return null

            const query = keywords.join(' OR ') + ' latest news Canada'
            try {
                const results = await searchPerplexity(query)
                return `Search results for keywords [${keywords.join(', ')}]:\n\n${results}`
            } catch (error) {
                console.error('[runner] Keyword search failed:', error)
                return null
            }
        }

        default:
            return null
    }
}
