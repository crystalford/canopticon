import OpenAI from 'openai'

// Model tiers as defined in 09_COST_AND_GATING
export const MODEL_TIERS = {
    cheap: 'gpt-4o-mini',      // Classification, dedup, scoring
    expensive: 'gpt-4o',        // Synthesis, headlines, exports
    embedding: 'text-embedding-3-small',
} as const

// Approximate costs per 1K tokens (USD)
export const MODEL_COSTS = {
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'gpt-4o': { input: 0.0025, output: 0.01 },
    'text-embedding-3-small': { input: 0.00002, output: 0 },
} as const

// Lazy-initialized OpenAI client to avoid build-time errors
let _openai: OpenAI | null = null
function getOpenAI(): OpenAI {
    if (!_openai) {
        _openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY || '',
        })
    }
    return _openai
}

export interface AIResponse<T> {
    success: boolean
    data?: T
    error?: string
    usage?: {
        inputTokens: number
        outputTokens: number
        costUsd: number
    }
}

/**
 * Call AI with structured JSON output
 */
export async function callAI<T>(params: {
    prompt: string
    input: object
    model?: keyof typeof MODEL_COSTS
    temperature?: number
}): Promise<AIResponse<T>> {
    const { prompt, input, model = 'gpt-4o-mini', temperature = 0.1 } = params

    try {
        const response = await getOpenAI().chat.completions.create({
            model,
            temperature,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: prompt },
                { role: 'user', content: JSON.stringify(input) },
            ],
        })

        const content = response.choices[0]?.message?.content
        if (!content) {
            return { success: false, error: 'No content in response' }
        }

        const data = JSON.parse(content) as T
        const usage = response.usage

        const costUsd = usage
            ? (usage.prompt_tokens / 1000) * MODEL_COSTS[model].input +
            (usage.completion_tokens / 1000) * MODEL_COSTS[model].output
            : 0

        return {
            success: true,
            data,
            usage: usage ? {
                inputTokens: usage.prompt_tokens,
                outputTokens: usage.completion_tokens,
                costUsd,
            } : undefined,
        }
    } catch (error) {
        console.error('AI call failed:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }
    }
}

/**
 * Generate embeddings for text
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
    try {
        const response = await getOpenAI().embeddings.create({
            model: MODEL_TIERS.embedding,
            input: text.slice(0, 8000), // Limit input size
        })
        return response.data[0]?.embedding ?? null
    } catch (error) {
        console.error('Embedding generation failed:', error)
        return null
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

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}


