import { GoogleGenerativeAI } from '@google/generative-ai'
import { getSetting, SETTINGS_KEYS } from '@/lib/db-settings'
import { db, briefs } from '@/db'
import { sql, desc } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'

export interface BriefStory {
    headline: string
    summary: string // Full context (500-1000 words)
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

const DISCOVERY_PROMPT = `You are a Canadian political news analyst with deep expertise in federal politics, policy, and parliamentary affairs.

Search the web for the top 5 most significant Canadian political stories from the last 24 hours.

For each story:
1. Read the full article(s) from reputable Canadian news sources
2. Provide a comprehensive 500-800 word summary with full context:
   - What happened
   - Why it matters
   - Background context
   - Political implications
   - Key quotes (if available)
3. Identify key political players (names and roles)
4. Rate significance (1-10) based on:
   - Impact on Canadians
   - Policy implications
   - Political consequences
   - Public interest
5. Cite 2-3 source URLs from reputable Canadian news outlets

Focus on:
- Federal politics and Parliament
- Major policy announcements
- Legislative changes
- Cabinet decisions
- Political controversies
- Economic policy
- International relations (Canada-focused)

Exclude:
- Provincial/municipal news (unless nationally significant)
- Sports, entertainment, lifestyle
- Minor procedural updates

Return ONLY valid JSON in this exact format:
{
  "stories": [
    {
      "headline": "Clear, compelling headline",
      "summary": "Full 500-800 word analysis with context...",
      "keyPlayers": ["Name (Role)", "Name (Role)"],
      "significance": 8,
      "sourceUrls": ["https://...", "https://..."]
    }
  ]
}

CRITICAL: Return ONLY the JSON object. No markdown, no code blocks, no explanations.`

export async function generateDailyBrief(): Promise<DailyBrief> {
    try {
        // Get configured AI provider and key
        const provider = await getSetting(SETTINGS_KEYS.AI_PROVIDER) || 'anthropic'

        let apiKey: string | null = null

        if (provider === 'anthropic') {
            apiKey = await getSetting(SETTINGS_KEYS.ANTHROPIC_API_KEY) || process.env.ANTHROPIC_API_KEY
        } else if (provider === 'gemini') {
            apiKey = await getSetting(SETTINGS_KEYS.GEMINI_API_KEY) || process.env.GEMINI_API_KEY
        } else {
            apiKey = await getSetting(SETTINGS_KEYS.OPENAI_API_KEY) || process.env.OPENAI_API_KEY
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
                    model: 'claude-3-5-sonnet-20241022',
                    max_tokens: 8000,
                    messages: [{
                        role: 'user',
                        content: DISCOVERY_PROMPT
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
            // Use Gemini
            const genAI = new GoogleGenerativeAI(apiKey)
            const model = genAI.getGenerativeModel({
                model: 'gemini-2.0-flash-exp',
                generationConfig: {
                    maxOutputTokens: 8000,
                }
            })

            const result = await model.generateContent(DISCOVERY_PROMPT)
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
                        content: DISCOVERY_PROMPT
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

        // Parse response
        const cleanedText = responseText.replace(/```json\n?|\n?```/g, '').trim()
        const parsed = JSON.parse(cleanedText)

        if (!parsed.stories || !Array.isArray(parsed.stories)) {
            throw new Error('Invalid response format from Gemini')
        }

        // Store in database
        const [brief] = await db.insert(briefs).values({
            generatedAt: new Date(),
            stories: parsed.stories,
            status: 'draft',
        }).returning()

        return {
            id: brief.id,
            generatedAt: brief.generatedAt,
            stories: parsed.stories as BriefStory[],
            status: brief.status as 'draft' | 'published',
        }

    } catch (error) {
        console.error('Failed to generate daily brief:', error)
        throw error
    }
}

export async function getTodaysBrief(): Promise<DailyBrief | null> {
    try {
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const [brief] = await db
            .select()
            .from(briefs)
            .where(sql`${briefs.generatedAt} >= ${today}`)
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
