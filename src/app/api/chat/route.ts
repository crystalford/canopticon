import { streamText, convertToModelMessages, stepCountIs, UIMessage } from 'ai'
import { chatModel } from '@/lib/ai/providers'
import { createTools } from '@/lib/ai/tools'
import { systemPrompt } from '@/lib/ai/system-prompt'
import { db, conversations, messages as messagesTable } from '@/db'

export const maxDuration = 60

export async function POST(req: Request) {
    const body = await req.json()
    const { messages, conversationId } = body as {
        messages: UIMessage[]
        conversationId?: string
    }

    // Create or get conversation
    let activeConversationId = conversationId || null

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

    const result = streamText({
        model: chatModel,
        system: systemPrompt,
        messages: modelMessages,
        tools,
        stopWhen: stepCountIs(5),
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
