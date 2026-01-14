import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getSetting, SETTINGS_KEYS } from '@/lib/db-settings'
import { generateObject, embed } from 'ai'
import { z } from 'zod'

// --- Types ---

export interface AIModel {
    id: string
    provider: 'openai' | 'anthropic' | 'grok' | 'gemini'
    contextWindow: number
    costPer1kInput: number
    costPer1kOutput: number
}

// --- Configuration ---

export const MODEL_TIERS = {
    'gpt-4o-mini': {
        id: 'gpt-4o-mini',
        provider: 'openai',
        contextWindow: 128000,
        costPer1kInput: 0.00015,
        costPer1kOutput: 0.0006,
    },
    'gpt-4o': {
        id: 'gpt-4o',
        provider: 'openai',
        contextWindow: 128000,
        costPer1kInput: 0.005, // $5/1M
        costPer1kOutput: 0.015, // $15/1M
    },
    'claude-3-5-sonnet-20240620': {
        id: 'claude-3-5-sonnet-20240620',
        provider: 'anthropic',
        contextWindow: 200000,
        costPer1kInput: 0.003,
        costPer1kOutput: 0.015,
    },
    'gemini-2.5-flash': {
        id: 'gemini-2.5-flash',
        provider: 'gemini',
        contextWindow: 1000000,
        costPer1kInput: 0, // Free tier
        costPer1kOutput: 0,
    },
} as const

// --- Client Factory ---

/**
 * Get the AI client based on configuration
 * Prioritizes Database Settings > Environment Variables
 */
async function getAIClient() {
    // 1. Check DB for provider preference
    const provider = await getSetting(SETTINGS_KEYS.AI_PROVIDER) || 'openai'

    // 2. Initialize based on provider
    if (provider === 'anthropic') {
        const apiKey = await getSetting(SETTINGS_KEYS.ANTHROPIC_API_KEY) || process.env.ANTHROPIC_API_KEY
        if (!apiKey) throw new Error('Anthropic API Key not configured')
        return createAnthropic({ apiKey })
    }

    if (provider === 'grok') {
        const apiKey = await getSetting(SETTINGS_KEYS.GROK_API_KEY) || process.env.GROK_API_KEY || process.env.OPENAI_API_KEY // Grok often uses OAI SDK? Assuming generic OpenAI-compatible for now
        // Note: Vercel AI SDK doesn't have native Grok yet, usually used via OpenAI compatible endpoint
        // For now, we will treat Grok as OpenAI-compatible
        if (!apiKey) throw new Error('Grok API Key not configured')

        return createOpenAI({
            apiKey,
            baseURL: 'https://api.x.ai/v1'
        })
    }

    if (provider === 'gemini') {
        const apiKey = await getSetting(SETTINGS_KEYS.GEMINI_API_KEY) || process.env.GEMINI_API_KEY
        if (!apiKey) throw new Error('Gemini API Key not configured')

        // Gemini uses its own SDK, not Vercel AI SDK
        // We'll return a wrapper that mimics the interface
        return new GoogleGenerativeAI(apiKey) as any
    }

    // Default: OpenAI
    const apiKey = await getSetting(SETTINGS_KEYS.OPENAI_API_KEY) || process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('OpenAI API Key not configured')
    return createOpenAI({ apiKey })
}

// --- Core Functions ---

export async function generateEmbedding(text: string): Promise<number[]> {
    try {
        const client = await getAIClient()
        // Note: Embeddings usually stick to OpenAI for consistency unless specific model requested
        // For simplicity in Phase 1, we ALWAYS use OpenAI for embeddings to ensure vector compatibility
        // or we need to re-index everything. 
        // DECISION: Hardcode OpenAI for embeddings for now.
        const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
        const model = openai.embedding('text-embedding-3-small')

        const { embedding } = await embed({
            model,
            value: text.replace(/\n/g, ' '),
        })
        return embedding
    } catch (error) {
        console.error('Embedding generation failed:', error)
        return []
    }
}

// Wrapper for `generateText` or `generateObject`

interface CallAIOptions<T> {
    prompt: string
    input: Record<string, any>
    model?: keyof typeof MODEL_TIERS
    jsonSchema?: z.ZodType<T> // Optional explicit schema if simple mode not enough
}

export async function callAI<T>(options: CallAIOptions<T>): Promise<{
    success: boolean
    data?: T
    error?: string
    usage?: { inputTokens: number; outputTokens: number; costUsd: number }
}> {
    try {
        const client = await getAIClient()
        const modelId = options.model || 'gpt-4o-mini'

        // Map model ID to provider-specific string if needed
        // For Vercel AI SDK, we pass the client-instantiated model
        // e.g. client('gpt-4o')

        let modelInstance;
        // Simple mapping for now
        if (modelId.startsWith('claude')) {
            modelInstance = client(modelId)
        } else {
            // For OpenAI/Grok
            modelInstance = client(modelId)
        }

        // We use generateObject for structured JSON output
        // The prompt usually contains the schema instruction, but Vercel AI SDK `generateObject` is better.
        // However, our current prompts are designed for raw JSON string output. 
        // Let's stick to text generation + JSON parse if we want to minimize change, 
        // OR switch to `generateObject` with `output: 'no-schema'` if the prompt handles it.
        // Given the prompt templates in `prompts.ts`, they expect to output Markdown or JSON.

        // Let's assume the prompts are strong enough to return JSON.
        const { text, usage } = await import('ai').then(ai => ai.generateText({
            model: modelInstance,
            messages: [
                { role: 'system', content: options.prompt },
                { role: 'user', content: JSON.stringify(options.input) }
            ],
            temperature: 0,
        }))

        // Clean up markdown code blocks if present
        const jsonStr = text.replace(/```json\n|\n```/g, '').trim()
        const data = JSON.parse(jsonStr) as T

        // Calculate Cost
        const tier = MODEL_TIERS[modelId as keyof typeof MODEL_TIERS] || MODEL_TIERS['gpt-4o-mini']
        const usageAny = usage as any
        const cost = (usageAny.promptTokens * tier.costPer1kInput / 1000) +
            (usageAny.completionTokens * tier.costPer1kOutput / 1000)

        return {
            success: true,
            data,
            usage: {
                inputTokens: usageAny.promptTokens,
                outputTokens: usageAny.completionTokens,
                costUsd: cost,
            }
        }
    } catch (error) {
        console.error('AI call failed:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        }
    }
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0

    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i]
        normA += a[i] * a[i]
        normB += b[i] * b[i]
    }

    if (normA === 0 || normB === 0) return 0
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}
