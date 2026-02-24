import { streamText, stepCountIs } from 'ai'
import { getModel, getSettings } from '@/lib/ai/providers'
import { createTools } from '@/lib/ai/tools'
import { personas } from '@/lib/ai/personas'
import { db } from '@/db'
import { agents, conversations, messages } from '@/db/schema'
import { eq } from 'drizzle-orm'

export const maxDuration = 60

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const rawMessages: { role: string; content: string }[] = body.messages || []
        const personaId: string = body.personaId || 'canopticon'
        const requestedModelProvider: string = body.modelProvider || ''
        const conversationId: string | null = body.conversationId || null

        if (rawMessages.length === 0) {
            return new Response(JSON.stringify({ error: 'No messages provided' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            })
        }

        // Get settings for API keys
        const config = await getSettings()

        // Determine system prompt and model provider
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

        // Get the model
        const model = await getModel(modelProvider as 'perplexity' | 'openai' | 'anthropic')

        // Extract the last user message content for saving
        const lastUserMessage = [...rawMessages].reverse().find(m => m.role === 'user')

        // Normalize messages for AI SDK (filter out system, ensure alternating)
        const normalizedMessages = rawMessages
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .filter(m => m.content?.trim())

        // Create tools, passing the conversationId for article linking
        const tools = createTools(conversationId || undefined)

        // Stream the response
        const result = streamText({
            model,
            system: systemPrompt,
            messages: normalizedMessages as any,
            tools,
            stopWhen: stepCountIs(10),
            onFinish: async ({ text }) => {
                // Save messages to DB after streaming completes
                try {
                    if (!conversationId || !lastUserMessage) return

                    // Check conversation exists
                    const [conv] = await db.select({ id: conversations.id })
                        .from(conversations)
                        .where(eq(conversations.id, conversationId))

                    if (!conv) return

                    // Save user message and assistant response
                    await db.insert(messages).values([
                        {
                            conversationId,
                            role: 'user',
                            content: lastUserMessage.content,
                        },
                        {
                            conversationId,
                            role: 'assistant',
                            content: text,
                        },
                    ])

                    // Update conversation updatedAt
                    await db.update(conversations)
                        .set({ updatedAt: new Date() })
                        .where(eq(conversations.id, conversationId))
                } catch (err) {
                    console.error('[Chat] Failed to save messages:', err)
                }
            },
        })

        return result.toTextStreamResponse()

    } catch (error: any) {
        console.error('[Chat API] Fatal error:', error)
        return new Response(JSON.stringify({ error: error?.message || 'An unexpected error occurred' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        })
    }
}
