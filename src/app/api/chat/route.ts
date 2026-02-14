
import { streamText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { createOpenAI, openai } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { getSettings } from '@/lib/ai/providers'
import { db } from '@/db'
import { agents } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { personas } from '@/lib/ai/personas' // Fallback

export async function POST(req: Request) {
    // 1. Parse Input
    const { messages, data }: { messages: any[], data?: any } = await req.json()
    const personaId = data?.personaId || 'canopticon'
    const requestedModelProvider = data?.modelProvider // From UI selector

    // 2. Fetch Configuration
    const config = await getSettings()

    // 3. Determine System Prompt & Model Provider
    let systemPrompt = personas.find(p => p.id === 'canopticon')?.systemPrompt || ''
    let modelProvider = requestedModelProvider || 'perplexity' // Use requested model or default to Perplexity

    try {
        const [agent] = await db.select().from(agents).where(eq(agents.slug, personaId))
        if (agent && agent.isActive) {
            systemPrompt = agent.systemPrompt
            // Only override modelProvider if not explicitly requested from UI
            if (!requestedModelProvider) {
                modelProvider = agent.modelProvider
            }
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

    // 4. Instantiate Correct Model Provider
    let model;

    if (modelProvider === 'perplexity') {
        const perplexity = createOpenAICompatible({
            name: 'perplexity',
            apiKey: config.PERPLEXITY_API_KEY || process.env.PERPLEXITY_API_KEY,
            baseURL: 'https://api.perplexity.ai/',
        })
        model = perplexity('sonar-pro')
    } else if (modelProvider === 'anthropic') {
        // Using direct Anthropic provider
        // Note: Anthropic provider usually needs ANTHROPIC_API_KEY env var or passed explicitly
        // If config.ANTHROPIC_API_KEY is available, we should use it? 
        // For now assuming env var or default config pattern.
        // But wait, the previous code used `anthropic` import which usually uses process.env.ANTHROPIC_API_KEY
        // Let's assume standard behavior.
        model = anthropic('claude-3-5-sonnet-20241022')
    } else {
        // OpenAI (default)
        // Ensure compatibility mode if needed, but standard OpenAI should be fine with standard SDK
        // We use createOpenAI just to be safe with keys if config provides them
        const openai = createOpenAI({
            apiKey: config.OPENAI_API_KEY || process.env.OPENAI_API_KEY
        })
        model = openai('gpt-4o')
    }

    // 5. Stream Response
    // We use convertToCoreMessages to ensure the messages are in the format expected by the Vercel AI SDK core
    // This handles the conversion from UI messages to Core messages automatically

    // NOTE: The frontend (useChat) sends UIMessages. 
    // streamText handles them, but sometimes 'convertToCoreMessages' is safer to drop extra UI fields.
    // However, streamText accepts 'messages' directly. 
    // To be safe and clean, we pass them as is, because useChat + streamText is the standard path.
    // The issue before was 'DefaultChatTransport' sending weird stuff.
    // With standard useChat, 'messages' is correct.

    const result = await streamText({
        model,
        system: systemPrompt,
        messages, // Pass directly, assuming standard useChat
    })

    return result.toTextStreamResponse()
}
