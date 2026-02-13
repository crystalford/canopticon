
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
    const requestedModelProvider = data?.modelProvider // From UI selector

    // 1. Fetch System Settings (Keys)
    const config = await getSettings()

    // 2. Fetch Agent Config
    let systemPrompt = personas.find(p => p.id === 'canopticon')?.systemPrompt || ''
    let modelProvider = requestedModelProvider || 'perplexity' // Use requested model or default to Perplexity
    let modelId = 'sonar-pro'

    try {
        const [agent] = await db.select().from(agents).where(eq(agents.slug, personaId))
        if (agent && agent.isActive) {
            systemPrompt = agent.systemPrompt
            // Only override modelProvider if not explicitly requested from UI
            if (!requestedModelProvider) {
                modelProvider = agent.modelProvider
            }
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
            baseURL: 'https://api.perplexity.ai/',
            compatibility: 'compatible',
            fetch: async (url, options) => {
                let finalUrl = url.toString();
                if (finalUrl.includes('perplexity.ai') && !finalUrl.includes('/chat/completions')) {
                    console.log('[Perplexity Fix] Redirecting URL:', finalUrl, 'to /chat/completions');
                    finalUrl = 'https://api.perplexity.ai/chat/completions';
                }
                if (finalUrl.endsWith('/responses')) {
                    console.log('[Perplexity Fix] Fixing /responses URL:', finalUrl);
                    finalUrl = 'https://api.perplexity.ai/chat/completions';
                }
                return fetch(finalUrl, options);
            }
        } as any)
        model = perplexity('llama-3.1-sonar-large-128k-online')
    } else {
        // Fallback / Default to OpenAI
        const openai = createOpenAI({ apiKey: config.OPENAI_API_KEY || process.env.OPENAI_API_KEY })
        model = openai('gpt-4o')
    }

    // Transform messages from parts format to content format
    const transformedMessages = messages.map((msg: any) => {
        if (msg.parts) {
            // Convert parts array to content string
            const content = msg.parts
                .map((part: any) => part.type === 'text' ? part.text : '')
                .join('')
            return {
                role: msg.role,
                content
            }
        }
        return msg
    })

    const result = await streamText({
        model,
        system: systemPrompt,
        messages: transformedMessages,
    })

    return result.toTextStreamResponse()
}
