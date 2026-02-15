
import { anthropic } from '@ai-sdk/anthropic'
import { createOpenAI, openai } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { db } from '@/db'
import { settings } from '@/db/schema'

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

export async function getModel(provider: 'openai' | 'anthropic' | 'perplexity' = 'perplexity', modelId?: string) {
    const config = await getSettings()

    if (provider === 'perplexity') {
        const perplexity = createOpenAICompatible({
            name: 'perplexity',
            apiKey: config.PERPLEXITY_API_KEY || process.env.PERPLEXITY_API_KEY,
            baseURL: 'https://api.perplexity.ai/',
        })
        return perplexity(modelId || 'sonar-pro')
    }

    if (provider === 'anthropic') {
        return anthropic(modelId || 'claude-sonnet-4-20250514')
    }

    // Default to OpenAI
    const apiKey = config.OPENAI_API_KEY || process.env.OPENAI_API_KEY
    const openaiProvider = createOpenAI({
        apiKey,
    })
    return openaiProvider(modelId || 'gpt-4o')
}
