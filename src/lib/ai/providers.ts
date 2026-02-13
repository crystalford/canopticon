
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

// Custom fetch to force correct Perplexity URL if SDK messes it up
const perplexityFetch = async (url: RequestInfo | URL, options?: RequestInit) => {
    let finalUrl = url.toString();
    // If SDK is trying to hit /responses or just base URL, force it to /chat/completions
    if (finalUrl.includes('perplexity.ai') && !finalUrl.includes('/chat/completions')) {
        console.log('[Perplexity Fix] Redirecting URL:', finalUrl, 'to /chat/completions');
        finalUrl = 'https://api.perplexity.ai/chat/completions';
    }
    // Also fix the weird /responses issue if it persists
    if (finalUrl.endsWith('/responses')) {
        console.log('[Perplexity Fix] Fixing /responses URL:', finalUrl);
        finalUrl = 'https://api.perplexity.ai/chat/completions';
    }

    return fetch(finalUrl, options);
}

export async function getChatModel() {
    // Using Perplexity Sonar Pro as default
    const config = await getSettings()
    const perplexity = createOpenAI({
        apiKey: config.PERPLEXITY_API_KEY || process.env.PERPLEXITY_API_KEY,
        baseURL: 'https://api.perplexity.ai/',
        compatibility: 'compatible',
        fetch: perplexityFetch
    } as any)
    return perplexity('llama-3.1-sonar-large-128k-online')
}

export async function getResearchModel() {
    const config = await getSettings()
    const apiKey = config.PERPLEXITY_API_KEY || process.env.PERPLEXITY_API_KEY || ''

    const perplexity = createOpenAI({
        apiKey,
        baseURL: 'https://api.perplexity.ai/',
        compatibility: 'compatible',
        fetch: perplexityFetch
    } as any)

    return perplexity('llama-3.1-sonar-large-128k-online')
}

export async function getWritingModel() {
    // Get user's preferred writing model from settings
    const config = await getSettings()
    const writingProvider = config.DEFAULT_WRITING_MODEL || 'openai' // Default to GPT-4o for writing

    if (writingProvider === 'perplexity') {
        const perplexity = createOpenAI({
            apiKey: config.PERPLEXITY_API_KEY || process.env.PERPLEXITY_API_KEY,
            baseURL: 'https://api.perplexity.ai/',
            compatibility: 'compatible',
            fetch: perplexityFetch
        } as any)
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
        const perplexity = createOpenAI({
            apiKey: config.PERPLEXITY_API_KEY || process.env.PERPLEXITY_API_KEY,
            baseURL: 'https://api.perplexity.ai/',
            compatibility: 'compatible',
            fetch: perplexityFetch
        } as any)
        return perplexity('llama-3.1-sonar-large-128k-online')
    } else if (factCheckProvider === 'openai') {
        return openai('gpt-4o')
    } else {
        // Anthropic (default)
        return anthropic('claude-3-5-sonnet-20241022')
    }
}
