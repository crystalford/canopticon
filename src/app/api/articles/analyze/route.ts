import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { callAI } from '@/lib/ai/client'
import { performLiveResearch } from '@/lib/research'

export const maxDuration = 120

// 1. Query Generation Persona
const INVESTIGATOR_PERSONA = `You are a Senior Forensic Researcher. 
Your goal is to investigate the provided news text to verify facts and uncover hidden context.
Generate 3 specific, targeted search queries to investigate:
1. The background/history of key entities.
2. Conflicts of interest or "subtext" (who benefits?).
3. Recent developments that might contradict the text.

Return strictly JSON format: { "queries": ["query 1", "query 2", "query 3"] }`

// 3. Forensic Synthesis Persona
const ANALYST_PERSONA = `You are the Chief Political Analyst for 'Canopticon,' a skeptical but fair-minded investigative outlet.
Your job is to examine a news story and provided research context to produce a rigorous, questioning analysis.

APPROACH:
- **Skeptical Inquiry, Not Accusation:** Question claims, examine gaps, and highlight what remains unanswered. But do NOT invent wrongdoing or speculate about hidden motives unless evidence supports it.
- **What is Known vs. Unknown:** Clearly distinguish verified facts from official claims, and note where information is missing or unclear.
- **Critical Through Questions:** Instead of asserting conspiracy, ask probing questions that a reader should be wondering.
- **Contextualize:** Use the research results to add background, history, or contradictions that illuminate the story.
- **Tone:** Measured, intellectually rigorous, slightly dry. Think investigative journalism, not tabloid.

STRUCTURE:
1. **Headline** (Direct, questioning or ironic, but not sensationalist)
2. **The Context** (What's the official story and why is it being told now?)
3. **What We Know** (Verified facts and observable information)
4. **What Remains Unclear** (Gaps, contradictions, or unanswered questions)
5. **The Deeper Question** (What should readers be asking that isn't being addressed?)

LENGTH: 500-700 words.
FORMAT: Markdown.`

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession()
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { text, headline } = await request.json()
        if (!text) return NextResponse.json({ error: 'Text required' }, { status: 400 })

        // --- STEP 1: QUERY GENERATION ---
        const safeText = String(text || '')
        const queryRes = await callAI<{ queries: string[] }>({
            model: 'claude-3-haiku-20240307',
            prompt: INVESTIGATOR_PERSONA,
            input: { headline, text: safeText.slice(0, 2000) }
        })

        if (!queryRes.success || !queryRes.data) {
            console.error('Query Gen Failed:', queryRes.error)
            // Fallback
            return NextResponse.json({ error: 'Failed to generate queries: ' + queryRes.error }, { status: 500 })
        }

        const queries = queryRes.data.queries || [headline]

        // --- STEP 2: THE INVESTIGATION ---
        const researchResults = await performLiveResearch(queries)

        // --- STEP 3: FORENSIC SYNTHESIS ---
        const prompt = `SOURCE SIGNAL: "${headline}"\n${text}\n\n--- INTELLIGENCE DOSSIER (LIVE SEARCH RESULTS) ---\n${researchResults}\n\n--- INSTRUCTION ---\nWrite the Deep Dive Report now.`

        const analysisRes = await callAI<string>({
            model: 'claude-3-haiku-20240307',
            prompt: ANALYST_PERSONA + '\n\nIMPORTANT: Wrap your report in <report> tags.',
            input: { task: prompt },
            outputFormat: 'text'
        })

        console.log('[Forensic Debug] Analysis Success:', analysisRes.success)
        if (analysisRes.error) console.error('[Forensic Debug] Analysis Error:', analysisRes.error)


        if (!analysisRes.success) {
            return NextResponse.json({
                success: true,
                analysis: `[DEBUG: AI CALL FAILED]\n\nError: ${analysisRes.error || 'Unknown AI error'}\n\nThis likely indicates an API issue, rate limit, or configuration problem.`,
                steps: { queries, researchSize: researchResults.length }
            })
        }

        const rawText = analysisRes.data || ''
        console.log('[Forensic Debug] Raw Text Length:', rawText.length)
        console.log('[Forensic Debug] Preview:', rawText.substring(0, 200))

        // Extract XML content
        const match = rawText.match(/<report>([\s\S]*)<\/report>/i)
        const analysis = match ? match[1].trim() : rawText.trim()

        if (!analysis || analysis.length < 50) {
            console.error('Analysis Extraction Failed. Raw:', rawText)
            // DEBUG MODE: Return the raw failure so we can see it in the UI
            return NextResponse.json({
                success: true,
                analysis: `[DEBUG: EXTRACTION FAILED]\n\nRaw Output:\n${rawText}\n\nError: Analysis too short or missing tags.`,
                steps: {
                    queries,
                    researchSize: researchResults.length
                }
            })
        }

        return NextResponse.json({
            success: true,
            analysis: analysis,
            steps: {
                queries,
                researchSize: researchResults.length
            }
        })

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
