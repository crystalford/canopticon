import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { getSetting, SETTINGS_KEYS } from '@/lib/db-settings'
import { performLiveResearch } from '@/lib/research'

export const maxDuration = 120

// 1. Query Generation Persona
const INVESTIGATOR_PERSONA = `You are a Senior Forensic Researcher. 
Your goal is to investigate the provided news text to verify facts and uncover hidden context.
Generate 3 specific, targeted search queries to investigate:
1. The background/history of key entities.
2. Conflicts of interest or "subtext" (who benefits?).
3. Recent developments that might contradict the text.

Return JSON format: { "queries": ["query 1", "query 2", "query 3"] }
`

// 3. Forensic Synthesis Persona
const ANALYST_PERSONA = `You are the Chief Political Analyst for 'Canopticon.' You are cynical, forensic, and penetrating. 
Your job is to take a neutral 'News Signal' and the provided 'Search Context' to write an investigative deep-dive.

GUIDELINES:
- **Decode diplomatic language:** (e.g., 'Fruitful' = 'Expensive/Transactional').
- **Find the leverage:** (e.g., Connect Canola to EVs/Steel).
- **Correct the Record:** If the search context contradicts the source (e.g. wrong job title, previous failures), correct it implicitly to show authority.
- **Tone:** Dark, insider, 'glassmorphism' aesthetic in text form. Scathing but fact-based.
- **Structure:** 
  1. Cynical Headline
  2. The Hook (Why this matters now)
  3. The Deep Dive (The real story)
  4. The Shadow Question (What they aren't saying)

LENGTH: 600-800 words.
FORMAT: Markdown.`

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession()
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { text, headline } = await request.json()
        if (!text) return NextResponse.json({ error: 'Text required' }, { status: 400 })

        // Get API Key
        const apiKey = (await getSetting(SETTINGS_KEYS.ANTHROPIC_API_KEY) || process.env.ANTHROPIC_API_KEY)
        if (!apiKey) return NextResponse.json({ error: 'AI not configured' }, { status: 500 })

        // --- STEP 1: QUERY GENERATION ---
        // Ask Claude to generate investigative queries
        const queryResponse = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-3-haiku-20240307', // Fast model for tool use
                max_tokens: 300,
                messages: [{
                    role: 'system',
                    content: INVESTIGATOR_PERSONA
                }, {
                    role: 'user',
                    content: `Analyze this text and generate search queries:\nTITLE: ${headline}\nTEXT: ${text.slice(0, 2000)}`
                }]
            })
        })

        const queryData = await queryResponse.json()
        const queryContent = queryData.content?.[0]?.text || ''

        // Parse JSON from response (heuristic cleanup)
        let queries: string[] = []
        try {
            const jsonMatch = queryContent.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0])
                queries = parsed.queries || []
            } else {
                // Fallback if no JSON found
                queries = [headline, 'Canada politics analysis', 'background context']
            }
        } catch (e) {
            console.error('Failed to parse query JSON', e)
            queries = [headline]
        }

        // --- STEP 2: THE INVESTIGATION ---
        // Perform live research (modular function)
        const researchResults = await performLiveResearch(queries)

        // --- STEP 3: FORENSIC SYNTHESIS ---
        // Pass Signal + Research to Claude for final report
        const prompt = `
SOURCE SIGNAL:
"${headline}"
${text}

--- INTELLIGENCE DOSSIER (LIVE SEARCH RESULTS) ---
${researchResults}

--- INSTRUCTION ---
Write the Deep Dive Report now.`

        const analysisResponse = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-3-opus-20240229', // Opus for maximum intelligence/writing capability
                max_tokens: 4000,
                messages: [{
                    role: 'system',
                    content: ANALYST_PERSONA
                }, {
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
            steps: {
                queries,
                researchSize: researchResults.length
            }
        })

    } catch (error: any) {
        console.error('Forensic Deep Dive Error:', error)
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        )
    }
}
