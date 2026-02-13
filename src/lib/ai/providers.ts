
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

export async function getChatModel() {
    // Using Perplexity Sonar Pro as default
    const config = await getSettings()

    const perplexity = createOpenAICompatible({
        name: 'perplexity',
        apiKey: config.PERPLEXITY_API_KEY || process.env.PERPLEXITY_API_KEY,
        baseURL: 'https://api.perplexity.ai/',
    })

    return perplexity('llama-3.1-sonar-large-128k-online')
}

export async function getResearchModel() {
    const config = await getSettings()
    const apiKey = config.PERPLEXITY_API_KEY || process.env.PERPLEXITY_API_KEY || ''

    const perplexity = createOpenAICompatible({
        name: 'perplexity',
        apiKey,
        baseURL: 'https://api.perplexity.ai/',
    })

    return perplexity('llama-3.1-sonar-large-128k-online')
}

export async function getWritingModel() {
    // Get user's preferred writing model from settings
    const config = await getSettings()
    const writingProvider = config.DEFAULT_WRITING_MODEL || 'openai' // Default to GPT-4o for writing

    if (writingProvider === 'perplexity') {
        const perplexity = createOpenAICompatible({
            name: 'perplexity',
            apiKey: config.PERPLEXITY_API_KEY || process.env.PERPLEXITY_API_KEY,
            baseURL: 'https://api.perplexity.ai/',
        })
        return perplexity('llama-3.1-sonar-large-128k-online')
    } else if (writingProvider === 'anthropic') {
        return anthropic('claude-3-5-sonnet-20241022')
    } else {
        // OpenAI (default)
        return openai('gpt-4o')
    }
}

export async function getFactCheckModel() {
    // Get user's preferred fact-check model from settings
    const config = await getSettings()
    const factCheckProvider = config.DEFAULT_FACTCHECK_MODEL || 'anthropic' // Default to Claude for fact-checking

    if (factCheckProvider === 'perplexity') {
        const perplexity = createOpenAICompatible({
            name: 'perplexity',
            apiKey: config.PERPLEXITY_API_KEY || process.env.PERPLEXITY_API_KEY,
            baseURL: 'https://api.perplexity.ai/',
        })
        return perplexity('llama-3.1-sonar-large-128k-online')
    } else if (factCheckProvider === 'openai') {
        return openai('gpt-4o')
    } else {
        // Anthropic (default)
        return anthropic('claude-3-5-sonnet-20241022')
    }
}
