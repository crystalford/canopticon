
import { getSettings } from '@/lib/ai/providers'
import { db } from '@/db'
import { agents } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { personas } from '@/lib/ai/personas'

// Provider configurations
const PROVIDERS = {
    perplexity: {
        url: 'https://api.perplexity.ai/chat/completions',
        defaultModel: 'sonar-pro',
        keyName: 'PERPLEXITY_API_KEY',
        buildHeaders: (apiKey: string) => ({
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        }),
        buildBody: (model: string, messages: any[], systemPrompt: string) => ({
            model,
            messages: [
                { role: 'system', content: systemPrompt },
                ...messages,
            ],
            stream: true,
        }),
    },
    openai: {
        url: 'https://api.openai.com/v1/chat/completions',
        defaultModel: 'gpt-4o',
        keyName: 'OPENAI_API_KEY',
        buildHeaders: (apiKey: string) => ({
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        }),
        buildBody: (model: string, messages: any[], systemPrompt: string) => ({
            model,
            messages: [
                { role: 'system', content: systemPrompt },
                ...messages,
            ],
            stream: true,
        }),
    },
    anthropic: {
        url: 'https://api.anthropic.com/v1/messages',
        defaultModel: 'claude-sonnet-4-20250514',
        keyName: 'ANTHROPIC_API_KEY',
        buildHeaders: (apiKey: string) => ({
            'x-api-key': apiKey,
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01',
        }),
        buildBody: (model: string, messages: any[], systemPrompt: string) => ({
            model,
            system: systemPrompt,
            messages,
            max_tokens: 4096,
            stream: true,
        }),
    },
}

// Convert UIMessage (parts-based) or legacy message to simple {role, content}
function normalizeMessages(rawMessages: any[]): { role: 'user' | 'assistant'; content: string }[] {
    if (!Array.isArray(rawMessages)) return []
    const normalized: { role: 'user' | 'assistant'; content: string }[] = []

    for (const msg of rawMessages) {
        if (msg.role === 'system') continue
        if (msg.role !== 'user' && msg.role !== 'assistant') continue

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

        const last = normalized[normalized.length - 1]
        if (last && last.role === msg.role) {
            last.content += '\n' + content
        } else {
            normalized.push({ role: msg.role, content })
        }
    }

    return normalized
}

// Parse SSE from OpenAI-compatible providers (Perplexity, OpenAI)
// and transform into a simple text stream
function createOpenAITextStream(providerStream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()
    let buffer = ''

    return new ReadableStream({
        async start(controller) {
            const reader = providerStream.getReader()
            try {
                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break

                    buffer += decoder.decode(value, { stream: true })
                    const lines = buffer.split('\n')
                    buffer = lines.pop() || '' // Keep incomplete line in buffer

                    for (const line of lines) {
                        const trimmed = line.trim()
                        if (!trimmed || !trimmed.startsWith('data: ')) continue
                        const data = trimmed.slice(6)
                        if (data === '[DONE]') continue

                        try {
                            const parsed = JSON.parse(data)
                            const content = parsed.choices?.[0]?.delta?.content
                            if (content) {
                                controller.enqueue(encoder.encode(content))
                            }
                        } catch {
                            // Skip malformed JSON
                        }
                    }
                }
            } catch (err) {
                controller.error(err)
            } finally {
                controller.close()
            }
        },
    })
}

// Parse SSE from Anthropic and transform into a simple text stream
function createAnthropicTextStream(providerStream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()
    let buffer = ''

    return new ReadableStream({
        async start(controller) {
            const reader = providerStream.getReader()
            try {
                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break

                    buffer += decoder.decode(value, { stream: true })
                    const lines = buffer.split('\n')
                    buffer = lines.pop() || ''

                    for (const line of lines) {
                        const trimmed = line.trim()
                        if (!trimmed || !trimmed.startsWith('data: ')) continue
                        const data = trimmed.slice(6)

                        try {
                            const parsed = JSON.parse(data)
                            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                                controller.enqueue(encoder.encode(parsed.delta.text))
                            }
                        } catch {
                            // Skip malformed JSON
                        }
                    }
                }
            } catch (err) {
                controller.error(err)
            } finally {
                controller.close()
            }
        },
    })
}

export async function POST(req: Request) {
    try {
        // 1. Parse Input
        const body = await req.json()
        const rawMessages = body.messages
        const personaId = body.personaId || 'canopticon'
        const requestedModelProvider = body.modelProvider

        // 2. Normalize messages
        const messages = normalizeMessages(rawMessages)

        if (messages.length === 0) {
            return new Response(JSON.stringify({ error: 'No valid messages provided' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            })
        }

        // 3. Fetch Configuration (BYOK keys from DB)
        const config = await getSettings()

        // 4. Determine System Prompt & Model Provider
        let systemPrompt = personas.find(p => p.id === 'canopticon')?.systemPrompt || ''
        let modelProvider = requestedModelProvider || config.DEFAULT_MODEL_PROVIDER || 'perplexity'

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
        } catch {
            // agents table may not exist yet — fall back to static personas
            const p = personas.find(p => p.id === personaId)
            if (p) systemPrompt = p.systemPrompt
        }

        // 5. Get Provider Config
        const providerKey = modelProvider as keyof typeof PROVIDERS
        const provider = PROVIDERS[providerKey] || PROVIDERS.perplexity

        const apiKey = config[provider.keyName] || process.env[provider.keyName]
        if (!apiKey) {
            return new Response(JSON.stringify({ error: `No API key configured for ${modelProvider}. Add it in Settings.` }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            })
        }

        // 6. Direct fetch to provider API
        const providerResponse = await fetch(provider.url, {
            method: 'POST',
            headers: provider.buildHeaders(apiKey),
            body: JSON.stringify(provider.buildBody(provider.defaultModel, messages, systemPrompt)),
        })

        if (!providerResponse.ok) {
            const errorText = await providerResponse.text()
            console.error(`[API] Provider ${modelProvider} returned ${providerResponse.status}:`, errorText)
            return new Response(JSON.stringify({ error: `${modelProvider} API error: ${providerResponse.status}` }), {
                status: 502,
                headers: { 'Content-Type': 'application/json' },
            })
        }

        if (!providerResponse.body) {
            return new Response(JSON.stringify({ error: 'No response body from provider' }), {
                status: 502,
                headers: { 'Content-Type': 'application/json' },
            })
        }

        // 7. Transform provider SSE into plain text stream
        const textStream = providerKey === 'anthropic'
            ? createAnthropicTextStream(providerResponse.body)
            : createOpenAITextStream(providerResponse.body)

        return new Response(textStream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Transfer-Encoding': 'chunked',
            },
        })

    } catch (error: any) {
        console.error('[API] Chat API Fatal Error:', error)
        return new Response(JSON.stringify({ error: error?.message || 'An unexpected error occurred' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        })
    }
}
