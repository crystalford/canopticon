import { streamText, convertToModelMessages, stepCountIs, UIMessage } from 'ai'
import { chatModel } from '@/lib/ai/providers'
import { createTools } from '@/lib/ai/tools'
import { systemPrompt } from '@/lib/ai/system-prompt'
import { getSystemPrompt } from '@/lib/ai/personas'
import { db, conversations, messages as messagesTable } from '@/db'

export const maxDuration = 120

export async function POST(req: Request) {
    const body = await req.json()
    const { messages, conversationId, personaId } = body as {
        messages: UIMessage[]
        conversationId?: string
        personaId?: string
    }

    // Create or get conversation
    let activeConversationId = conversationId || null

    // ... (rest of conversation creation logic is unchanged)

    // Helper to extract text from UIMessage parts
    function getMessageText(msg: UIMessage): string {
        return msg.parts
            .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
            .map(p => p.text)
            .join('')
    }

    if (!activeConversationId) {
        // Create new conversation - title from first user message
        const firstUserMsg = messages.find(m => m.role === 'user')
        const title = firstUserMsg ? getMessageText(firstUserMsg).slice(0, 100) : 'New conversation'

        const [conversation] = await db.insert(conversations).values({
            title: title || 'New conversation',
        }).returning()

        activeConversationId = conversation.id
    }

    // Save the latest user message to DB
    const lastMessage = messages[messages.length - 1]
    if (lastMessage?.role === 'user') {
        const text = getMessageText(lastMessage)
        if (text) {
            await db.insert(messagesTable).values({
                conversationId: activeConversationId,
                role: 'user',
                content: text,
            })
        }
    }

    // Convert UI messages to model messages
    const modelMessages = await convertToModelMessages(messages)

    const tools = createTools(activeConversationId)

    // Add current date and time context to system prompt
    const now = new Date()
    const dateTimeStr = now.toLocaleString('en-CA', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
        timeZone: 'America/Toronto'
    })

    // Select Persona System Prompt
    const basePrompt = getSystemPrompt(personaId || null)
    const enhancedSystemPrompt = `CURRENT DATE & TIME: ${dateTimeStr}\n\n${basePrompt}`

    const result = streamText({
        model: chatModel,
        system: enhancedSystemPrompt,
        messages: modelMessages,
        tools,
        stopWhen: stepCountIs(15),
        onFinish: async ({ text }) => {
            // Save assistant response to DB
            if (text && activeConversationId) {
                await db.insert(messagesTable).values({
                    conversationId: activeConversationId,
                    role: 'assistant',
                    content: text,
                })
            }
        },
    })

    return result.toUIMessageStreamResponse({
        headers: {
            'X-Conversation-Id': activeConversationId,
        },
    })
}
