import { NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai/client'
import { PROMPTS, BroadcastThreadInput, BroadcastThreadOutput } from '@/lib/ai/prompts'

export async function POST(req: NextRequest) {
    try {
        const { headline, summary, url } = await req.json()

        if (!headline || !url) {
            return NextResponse.json({ error: 'Missing headline or URL' }, { status: 400 })
        }

        const input: BroadcastThreadInput = {
            headline,
            summary: summary || headline, // Fallback if no summary
            url
        }

        const result = await callAI<BroadcastThreadOutput>({
            prompt: PROMPTS.BROADCAST_THREAD_V1.prompt,
            input,
            model: 'gpt-4o' // Use smarter model for creative writing
        })

        if (!result.success || !result.data) {
            console.error('AI Error:', result.error)
            return NextResponse.json(
                { error: 'AI generation failed', details: result.error },
                { status: 500 }
            )
        }

        return NextResponse.json({ thread: result.data.thread })

    } catch (error: any) {
        console.error('Broadcast generation failed:', error)
        return NextResponse.json(
            { error: 'Failed to generate draft', details: error.message },
            { status: 500 }
        )
    }
}

