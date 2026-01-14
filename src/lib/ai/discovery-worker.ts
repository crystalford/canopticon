import { GoogleGenerativeAI } from '@google/generative-ai'
import { getSetting, SETTINGS_KEYS } from '@/lib/db-settings'
import { db, briefs } from '@/db'
import { sql, desc } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'

export interface BriefStory {
    headline: string
    summary: string // Full context (500-800 words)
    keyPlayers: string[]
    significance: number // 1-10
    sourceUrls: string[]
    videoScript?: string
}

export interface DailyBrief {
    id: string
    generatedAt: Date
    stories: BriefStory[]
    status: 'draft' | 'published'
}

const DISCOVERY_PROMPT = `You are CANOPTICON, a domain-aware synthesis engine for Canadian news.

CORE PRINCIPLE:
All news stories decompose into: Event Reality → Institutional Constraints → Implications.
You must respect strict layer separation to prevent hallucinations.

STEP 0 — DOMAIN DETECTION (MANDATORY)
Before writing, classify the story's primary domain:
- Political / Governance
- Legal / Judicial
- Economic / Financial
- Public Health
- Other (specify)

LAYER 1 — EVENT REALITY (UNIVERSAL, NON-NEGOTIABLE)
Answer ONLY:
- What occurred
- Who or what was involved
- When and where
- Under what formal authority

CONSTRAINTS:
- No interpretation
- No implied causality
- No projections
- If sources conflict, state uncertainty explicitly

LAYER 2 — INSTITUTIONAL CONSTRAINTS (DOMAIN-SPECIFIC)
Enforce domain-appropriate rules:

FOR POLITICAL STORIES:
- Succession authority belongs ONLY to the affected party/institution
- Opposition parties can "respond" or "position," NOT "act" procedurally
- Majority/minority status must be verified across sources
- If uncertain, use "will be determined" language

FOR LEGAL STORIES:
- Identify court jurisdiction
- Distinguish binding vs advisory rulings

FOR ECONOMIC STORIES:
- Identify regulatory authority
- Note contractual vs legislative obligations

UNIVERSAL CONSTRAINTS:
- No cross-institution inference
- No assumption of authority
- Default to uncertainty if unclear

LAYER 3 — IMPLICATIONS (OPTIONAL, GUARDED)
You may add:
- Risks and uncertainty
- Strategic impact
- Historical precedent (clearly framed)

DISALLOWED:
- New factual claims
- New actors or procedures
- Ideological framing unless sourced

Style:
- CP Wire Style (neutral, objective)
- DO NOT say "This story is rated X/10"
- DO NOT list "Key Players include..."
- START with dateline city (e.g., "OTTAWA - ...")

VALIDATION CHECK:
Before output, verify:
1. Domain correctly identified?
2. Authorities appropriate to domain?
3. No cross-contamination of party/institution powers?
4. Could Layer 3 be removed without breaking factual integrity?

If ANY check fails, revert to factual summary only.

Return ONLY valid XML:
<brief>
  <story>
    <headline>Compelling Headline</headline>
    <summary>
      OTTAWA - (Layer 1: Event facts)
      
      (Layer 2: Institutional context, if clear)
      
      (Layer 3: Implications, if warranted)
    </summary>
    <key_players>Name (Role), Name (Role)</key_players>
    <significance>8</significance>
    <sources>https://source1.com, https://source2.com</sources>
  </story>
</brief>

CRITICAL: Return ONLY the XML. No markdown.`

// Google News RSS for Canadian Politics (Last 24h)
const GOOGLE_NEWS_RSS = 'https://news.google.com/rss/search?q=Canadian+federal+politics+Parliament+Canada+when:1d&hl=en-CA&gl=CA&ceid=CA:en'

async function fetchNewsContext(): Promise<string> {
    try {
        const res = await fetch(GOOGLE_NEWS_RSS)
        const xml = await res.text()

        // Simple regex parse to avoid deps (robust enough for Google News RSS structure)
        const items = xml.match(/<item>[\s\S]*?<\/item>/g) || []

        return items.slice(0, 20).map(item => {
            const title = item.match(/<title>(.*?)<\/title>/)?.[1] || ''
            const link = item.match(/<link>(.*?)<\/link>/)?.[1] || ''
            const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || ''
            const description = item.match(/<description>(.*?)<\/description>/)?.[1] || ''
                .replace(/<[^>]*>/g, '') // Strip HTML
                .replace('&nbsp;', ' ')

            return `Title: ${title}\nDate: ${pubDate}\nLink: ${link}\nContext: ${description}\n---`
        }).join('\n')
    } catch (e) {
        console.error('Failed to fetch news context:', e)
        return ''
    }
}

export async function generateDailyBrief(): Promise<DailyBrief> {
    try {
        // 1. Fetch Real-time Context
        const newsContext = await fetchNewsContext()

        if (!newsContext) {
            throw new Error('Failed to fetch current news context for analysis')
        }

        const promptWithContext = `${DISCOVERY_PROMPT}\n\nREAL-TIME NEWS CONTEXT (LAST 24 HOURS):\n${newsContext}`

        // Get configured AI provider and key
        const provider = await getSetting(SETTINGS_KEYS.AI_PROVIDER) || 'anthropic'

        let apiKey: string | null = null

        if (provider === 'anthropic') {
            apiKey = (await getSetting(SETTINGS_KEYS.ANTHROPIC_API_KEY) || process.env.ANTHROPIC_API_KEY) ?? null
        } else if (provider === 'gemini') {
            apiKey = (await getSetting(SETTINGS_KEYS.GEMINI_API_KEY) || process.env.GEMINI_API_KEY) ?? null
        } else {
            apiKey = (await getSetting(SETTINGS_KEYS.OPENAI_API_KEY) || process.env.OPENAI_API_KEY) ?? null
        }

        if (!apiKey) {
            throw new Error(`${provider} API Key not configured`)
        }

        let responseText: string

        if (provider === 'anthropic') {
            // Use Anthropic Claude
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: 'claude-3-haiku-20240307',
                    max_tokens: 4096, // Haiku max output
                    messages: [{
                        role: 'user',
                        content: promptWithContext
                    }]
                })
            })

            if (!response.ok) {
                const error = await response.text()
                throw new Error(`Anthropic API error: ${error}`)
            }

            const data = await response.json()
            responseText = data.content[0].text

        } else if (provider === 'gemini') {
            // Use Gemini - 2.0-flash-exp is the only one consistently available on free tier/v1beta
            const genAI = new GoogleGenerativeAI(apiKey)
            const model = genAI.getGenerativeModel({
                model: 'gemini-2.0-flash-exp',
                generationConfig: {
                    maxOutputTokens: 8000,
                }
            })

            const result = await model.generateContent(promptWithContext)
            const response = await result.response
            responseText = response.text()

        } else {
            // Use OpenAI
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [{
                        role: 'user',
                        content: promptWithContext
                    }],
                    max_tokens: 8000
                })
            })

            if (!response.ok) {
                const error = await response.text()
                throw new Error(`OpenAI API error: ${error}`)
            }

            const data = await response.json()
            responseText = data.choices[0].message.content
        }

        // XML Parsing Logic
        const stories: BriefStory[] = []

        // Simple Regex XML Parser (Robust for AI output)
        const storyMatches = responseText.match(/<story>[\s\S]*?<\/story>/g) || []

        for (const match of storyMatches) {
            const headline = match.match(/<headline>([\s\S]*?)<\/headline>/)?.[1]?.trim() || ''
            const summary = match.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.trim() || ''
            const significanceStr = match.match(/<significance>([\s\S]*?)<\/significance>/)?.[1]?.trim() || '0'
            const playersStr = match.match(/<key_players>([\s\S]*?)<\/key_players>/)?.[1]?.trim() || ''
            const sourcesStr = match.match(/<sources>([\s\S]*?)<\/sources>/)?.[1]?.trim() || ''

            if (headline && summary) {
                stories.push({
                    headline,
                    summary,
                    significance: parseInt(significanceStr) || 5,
                    keyPlayers: playersStr.split(',').map(s => s.trim()).filter(s => s),
                    sourceUrls: sourcesStr.split(',').map(s => s.trim()).filter(s => s)
                })
            }
        }

        if (stories.length === 0) {
            throw new Error('Failed to parse any stories from AI response (XML)')
        }

        // Store in database
        const [brief] = await db.insert(briefs).values({
            generatedAt: new Date(),
            stories: stories,
            status: 'draft',
        }).returning()

        return {
            id: brief.id,
            generatedAt: brief.generatedAt,
            stories: stories,
            status: brief.status as 'draft' | 'published',
        }

    } catch (error) {
        console.error('Failed to generate daily brief:', error)
        throw error
    }
}

export async function getTodaysBrief(): Promise<DailyBrief | null> {
    try {
        // Look for any brief generated in the last 24 hours
        // This is more robust than "today at 00:00" which involves timezone complexity
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

        const [brief] = await db
            .select()
            .from(briefs)
            .where(sql`${briefs.generatedAt} >= ${twentyFourHoursAgo}`)
            .orderBy(desc(briefs.generatedAt))
            .limit(1)

        if (!brief) return null

        return {
            id: brief.id,
            generatedAt: brief.generatedAt,
            stories: brief.stories as BriefStory[],
            status: brief.status as 'draft' | 'published',
        }
    } catch (error) {
        console.error('Failed to fetch today\'s brief:', error)
        return null
    }
}
