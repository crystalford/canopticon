import { NextRequest, NextResponse } from 'next/server'
import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
    try {
        const { text, task, context } = await req.json()

        if (!text || !task) {
            return NextResponse.json({ error: 'Missing text or task' }, { status: 400 })
        }

        let prompt = ''
        let system = 'You are an expert editor for a high-end political intelligence publication (Canopticon). Your tone is objective, precise, and analytical.'

        switch (task) {
            case 'fix_grammar':
                system += ' Fix grammar, spelling, and awkward phrasing. Maintain the original meaning perfectly. tailored for Canadian English.'
                prompt = `Fix grammar/spelling in this text:\n\n"${text}"`
                break

            case 'simplify':
                system += ' Rewrite the text to be more concise and clearer. Aim for Grade 10 reading level but keep professional vocabulary.'
                prompt = `Simplify this text:\n\n"${text}"`
                break

            case 'expand':
                system += ' Expand on the following text by adding 1-2 sentences of relevant context or detail. Do not hallucinate facts. If unsure, just clear up the flow.'
                prompt = `Expand this text (Context: ${context || 'General article'}):\n\n"${text}"`
                break

            case 'shorten':
                system += ' Condense the text by removing fluff and redundancy.'
                prompt = `Shorten this text:\n\n"${text}"`
                break

            case 'tone_journalistic':
                system += ' Rewrite to sound like a neutral, high-quality AP/CP wire service report.'
                prompt = `Rewrite in strict journalistic tone:\n\n"${text}"`
                break

            default:
                return NextResponse.json({ error: 'Invalid task' }, { status: 400 })
        }

        const { text: result } = await generateText({
            model: anthropic('claude-3-haiku-20240307'),
            system: system,
            prompt: prompt,
            temperature: 0.3,
        })

        return NextResponse.json({ result })

    } catch (error) {
        console.error('AI Enhance Error:', error)
        return NextResponse.json({ error: 'Failed to process' }, { status: 500 })
    }
}
