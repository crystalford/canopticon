import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { getSetting, SETTINGS_KEYS } from '@/lib/db-settings'
import { fetchTopicContext } from '@/lib/news-fetcher'

export const maxDuration = 120 // Allow longer timeout for research

const ANALYST_PERSONA = `You are the Chief Political Analyst for Canopticon. You are forensic, skeptical, and penetrating. 
Take the provided Source Article and the Intelligence Context to write a biting intelligence report (The "Deep Dive").

Guidelines:
- Decode diplomatic language (e.g., 'fruitful' = 'transactional/heated').
- Correct any factual errors or omissions in the source using the Intelligence Context.
- TONE: 'Dark Mode', insider, investigative, cynical but factual.
- FORMAT: Markdown. Use headers like "## The Subtext", "## Key Players", "## Strategic Implications".
- LENGTH: 600-1000 words.`

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession()
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { text, headline } = await request.json()
        if (!text) return NextResponse.json({ error: 'Text required' }, { status: 400 })

        // 1. Entity Extraction (Simple heuristic or fast LLM call)
        // For speed/cost, we'll try a fast LLM call first to get search terms
        const apiKey = (await getSetting(SETTINGS_KEYS.ANTHROPIC_API_KEY) || process.env.ANTHROPIC_API_KEY)
        if (!apiKey) return NextResponse.json({ error: 'AI not configured' }, { status: 500 })

        // Step 1: Identify Search Terms
        const termResponse = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-3-haiku-20240307',
                max_tokens: 100,
                messages: [{
                    role: 'user',
                    content: `Extract 2 most critical entities or topics from this text for background research. Return ONLY the terms separated by comma. Text: ${headline} ${text.slice(0, 500)}`
                }]
            })
        })
        const termData = await termResponse.json()
        const terms = termData.content?.[0]?.text?.split(',').map((t: string) => t.trim()) || [headline]

        // Step 2: Research (Parallel Fetch)
        const contextPromises = terms.map((term: string) => fetchTopicContext(term))
        const contextResults = await Promise.all(contextPromises)
        const researchContext = contextResults.join('\n\n')

        // Step 3: Synthesis
        const prompt = `${ANALYST_PERSONA}

SOURCE ARTICLE:
${headline}
${text}

INTELLIGENCE CONTEXT (Real-time Search):
${researchContext}

Execute the Deep Dive now.`

        const analysisResponse = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-3-opus-20240229', // Opus for high quality analysis
                max_tokens: 4000,
                messages: [{
                    role: 'user',
                    content: prompt
                }]
            })
        })

        const analysisData = await analysisResponse.json()
        const analysis = analysisData.content?.[0]?.text

        if (!analysis) throw new Error('Failed to generate analysis')

        return NextResponse.json({
            success: true,
            analysis,
            terms // returning terms for debug visibility
        })

    } catch (error) {
        console.error('Forensic Deep Dive Error:', error)
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        )
    }
}
