
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
        console.log('[API] Chat request received')

        // 1. Parse Input
        const body = await req.json()
        const rawMessages = body.messages
        const personaId = body.personaId || 'canopticon'
        const requestedModelProvider = body.modelProvider

        console.log(`[API] Params: personaId=${personaId}, provider=${requestedModelProvider}, rawMessages=${rawMessages?.length}`)

        // 2. Normalize messages to simple {role, content} with alternating roles
        const messages = normalizeMessages(rawMessages)
        console.log(`[API] Normalized messages: ${messages.length}`)
        if (messages.length > 0) {
            console.log(`[API] First message role: ${messages[0].role}`)
            console.log(`[API] Last message role: ${messages[messages.length - 1].role}`)
        }

        if (messages.length === 0) {
            console.error('[API] Error: No valid messages provided after normalization')
            return new Response(JSON.stringify({ error: 'No valid messages provided' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            })
        }

        // 3. Fetch Configuration
        const config = await getSettings()
        console.log('[API] Settings loaded')

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
            console.error('[API] Error fetching agent/persona:', e)
            const p = personas.find(p => p.id === personaId)
            if (p) systemPrompt = p.systemPrompt
        }

        console.log(`[API] Using provider: ${modelProvider}`)

        // 5. Instantiate Model
        let model;

        if (modelProvider === 'perplexity') {
            const apiKey = config.PERPLEXITY_API_KEY || process.env.PERPLEXITY_API_KEY
            console.log('[API] Perplexity Key present:', !!apiKey)
            if (apiKey) console.log('[API] Key starts with:', apiKey.substring(0, 4))

            // MANUAL DEBUG FETCH
            try {
                console.log('[API] Testing Perplexity connection manually...')
                const debugRes = await fetch('https://api.perplexity.ai/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'sonar',
                        messages: [{ role: 'user', content: 'ping' }]
                    })
                })
                console.log('[API] Manual fetch status:', debugRes.status)
                const debugText = await debugRes.text()
                console.log('[API] Manual fetch response:', debugText.substring(0, 200))
            } catch (debugErr) {
                console.error('[API] Manual fetch failed:', debugErr)
            }

            // Revert to createOpenAICompatible - createOpenAI was hitting wrong endpoint (/responses or /v1)
            const perplexity = createOpenAICompatible({
                name: 'perplexity',
                apiKey: apiKey,
                baseURL: 'https://api.perplexity.ai/',
            })
            // Switch to 'sonar' (lighter) to verify flow, preventing 'sonar-pro' timeouts if any
            model = perplexity('sonar')
        } else if (modelProvider === 'anthropic') {
            model = anthropic('claude-3-5-sonnet-20241022')
        } else {
            const apiKey = config.OPENAI_API_KEY || process.env.OPENAI_API_KEY
            console.log('[API] OpenAI Key present:', !!apiKey)

            const openai = createOpenAI({
                apiKey: apiKey
            })
            model = openai('gpt-4o')
        }

        console.log('[API] Model instantiated, starting stream...')

        // 6. Stream Response
        const result = await streamText({
            model,
            system: systemPrompt,
            messages,
        })

        console.log('[API] Stream created successfully')

        return result.toTextStreamResponse()

    } catch (error: any) {
        console.error('[API] Chat API Fatal Error:', error)
        // Log the full error object structure if possible
        if (error.responseBody) console.error('[API] Error Response Body:', error.responseBody)

        const message = error?.message || error?.data?.error?.message || 'An unexpected error occurred'
        return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        })
    }
}
