
import { streamText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { getSettings } from '@/lib/ai/providers'
import { db } from '@/db'
import { agents } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { personas } from '@/lib/ai/personas' // Fallback

export async function POST(req: Request) {
    const { messages, data }: { messages: any[], data?: any } = await req.json()
    const personaId = data?.personaId || 'canopticon'

    // 1. Fetch System Settings (Keys)
    const config = await getSettings()

    // 2. Fetch Agent Config
    let systemPrompt = personas.find(p => p.id === 'canopticon')?.systemPrompt || ''
    let modelProvider = 'anthropic' // Default base
    let modelId = 'claude-3-5-sonnet-20240620'

    try {
        const [agent] = await db.select().from(agents).where(eq(agents.slug, personaId))
        if (agent && agent.isActive) {
            systemPrompt = agent.systemPrompt
            modelProvider = agent.modelProvider
            // modelId = agent.modelId // If we implemented specific model selection
        } else {
            // Fallback to static
            const p = personas.find(p => p.id === personaId)
            if (p) systemPrompt = p.systemPrompt
        }
    } catch (e) {
        // Fallback to static
        const p = personas.find(p => p.id === personaId)
        if (p) systemPrompt = p.systemPrompt
    }

    // 3. Select Model Instance
    let model;

    if (modelProvider === 'openai') {
        const openai = createOpenAI({ apiKey: config.OPENAI_API_KEY || process.env.OPENAI_API_KEY })
        model = openai('gpt-4o')
    } else if (modelProvider === 'perplexity') {
        const perplexity = createOpenAI({
            apiKey: config.PERPLEXITY_API_KEY || process.env.PERPLEXITY_API_KEY,
            baseURL: 'https://api.perplexity.ai'
        })
        model = perplexity('sonar-pro')
    } else {
        // Fallback / Default to OpenAI
        const openai = createOpenAI({ apiKey: config.OPENAI_API_KEY || process.env.OPENAI_API_KEY })
        model = openai('gpt-4o')
    }

    const result = await streamText({
        model,
        system: systemPrompt,
        messages,
    })

    return (result as any).toDataStreamResponse()
}
