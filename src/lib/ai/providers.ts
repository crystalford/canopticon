
import { anthropic } from '@ai-sdk/anthropic'
import { createOpenAI, openai } from '@ai-sdk/openai'
import { db } from '@/db'
import { settings } from '@/db/schema'
import { eq } from 'drizzle-orm'

// Cache settings for a short time to avoid hitting DB on every token? 
// For now, per-request is safer for "dynamic" feel.

export async function getSettings() {
    try {
        const all = await db.select().from(settings)
        const config: Record<string, string> = {}
        all.forEach(s => config[s.key] = s.value)
        return config
    } catch (e) {
        return {}
    }
}

export async function getChatModel() {
    // Using Perplexity Sonar Pro as default
    const config = await getSettings()
    const perplexity = createOpenAI({
        apiKey: config.PERPLEXITY_API_KEY || process.env.PERPLEXITY_API_KEY,
        baseURL: 'https://api.perplexity.ai'
    })
    return perplexity('sonar-pro')
}

export async function getResearchModel() {
    const config = await getSettings()
    const apiKey = config.PERPLEXITY_API_KEY || process.env.PERPLEXITY_API_KEY || ''

    const perplexity = createOpenAI({
        apiKey,
        baseURL: 'https://api.perplexity.ai',
    })

    return perplexity('sonar-pro')
}
