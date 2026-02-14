
import { streamText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { getSettings } from '@/lib/ai/providers'
import { db } from '@/db'
import { agents } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { personas } from '@/lib/ai/personas'

// Convert UIMessage (parts-based) or legacy message to simple {role, content}
function normalizeMessages(rawMessages: any[]): { role: 'user' | 'assistant'; content: string }[] {
    if (!Array.isArray(rawMessages)) return []

    const normalized: { role: 'user' | 'assistant'; content: string }[] = []

    for (const msg of rawMessages) {
        // Skip system messages (system prompt is handled separately)
        if (msg.role === 'system') continue
        // Only keep user and assistant
        if (msg.role !== 'user' && msg.role !== 'assistant') continue

        // Extract text content from parts (UIMessage v3 format) or content (legacy)
        let content = ''
        if (msg.parts && Array.isArray(msg.parts)) {
            content = msg.parts
                .filter((p: any) => p.type === 'text')
                .map((p: any) => p.text || '')
                .join('\n')
                .trim()
        } else if (typeof msg.content === 'string') {
            content = msg.content.trim()
        }

        if (!content) continue

        // Enforce alternating roles: merge consecutive same-role messages
        const last = normalized[normalized.length - 1]
        if (last && last.role === msg.role) {
            last.content += '\n' + content
        } else {
            normalized.push({ role: msg.role, content })
        }
    }

    return normalized
}

export async function POST(req: Request) {
    try {
        // 1. Parse Input
        const body = await req.json()
        const rawMessages = body.messages
        const personaId = body.personaId || 'canopticon'
        const requestedModelProvider = body.modelProvider

        // 2. Normalize messages to simple {role, content} with alternating roles
        const messages = normalizeMessages(rawMessages)

        if (messages.length === 0) {
            return new Response(JSON.stringify({ error: 'No valid messages provided' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            })
        }

        // 3. Fetch Configuration
        const config = await getSettings()

        // 4. Determine System Prompt & Model Provider
        let systemPrompt = personas.find(p => p.id === 'canopticon')?.systemPrompt || ''
        let modelProvider = requestedModelProvider || 'perplexity'

        try {
            const [agent] = await db.select().from(agents).where(eq(agents.slug, personaId))
            if (agent && agent.isActive) {
                systemPrompt = agent.systemPrompt
                if (!requestedModelProvider) {
                    modelProvider = agent.modelProvider
                }
            } else {
                const p = personas.find(p => p.id === personaId)
                if (p) systemPrompt = p.systemPrompt
            }
        } catch (e) {
            const p = personas.find(p => p.id === personaId)
            if (p) systemPrompt = p.systemPrompt
        }

        // 5. Instantiate Model
        let model;

        if (modelProvider === 'perplexity') {
            const perplexity = createOpenAICompatible({
                name: 'perplexity',
                apiKey: config.PERPLEXITY_API_KEY || process.env.PERPLEXITY_API_KEY,
                baseURL: 'https://api.perplexity.ai/',
            })
            model = perplexity('sonar-pro')
        } else if (modelProvider === 'anthropic') {
            model = anthropic('claude-3-5-sonnet-20241022')
        } else {
            const openai = createOpenAI({
                apiKey: config.OPENAI_API_KEY || process.env.OPENAI_API_KEY
            })
            model = openai('gpt-4o')
        }

        // 6. Stream Response
        const result = await streamText({
            model,
            system: systemPrompt,
            messages,
        })

        return result.toTextStreamResponse()

    } catch (error: any) {
        console.error('Chat API error:', error)
        const message = error?.message || error?.data?.error?.message || 'An unexpected error occurred'
        return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        })
    }
}
