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

const DISCOVERY_PROMPT = `You are a Political News Editor for a Canadian wire service (CP Style).

Extract and write news stories from the provided REAL-TIME NEWS CONTEXT.
If a story is NOT in the context, DO NOT WRITE IT.

For each of the top 5 most significant stories:
1. Write a clear, objective news article based strictly on facts in the context.
2. Identify key political players.
3. Rate significance (1-10).

Style Rules:
- DO NOT say "This story is rated 8/10" in the text.
- DO NOT list "Key Players include..." in the text.
- DO NOT include layer labels like "(Layer 1:" or "(Layer 2:" in the text.
- START directly with the dateline city (e.g., "OTTAWA - ...").
- Be objective and factual.
- TONE: Professional, neutral (like Reuters/CP).

Return ONLY valid XML in this exact format:
<brief>
  <story>
    <headline>Compelling Headline</headline>
    <summary>
      OTTAWA - Quebec Premier François Legault has announced his resignation...
      
      (Continue with substantive article text. Write naturally, do not label sections.)
    </summary>
    <key_players>François Legault (Quebec Premier), Coalition Avenir Québec (Ruling party)</key_players>
    <significance>8</significance>
  </story>
</brief>

CRITICAL: Return ONLY the XML. No markdown. No layer labels in the text.`

// Google News RSS for Canadian Politics (Last 24h)
const GOOGLE_NEWS_RSS = 'https://news.google.com/rss/search?q=Canadian+federal+politics+Parliament+Canada+when:1d&hl=en-CA&gl=CA&ceid=CA:en'

interface NewsContextResult {
    context: string
    sourceUrls: string[]
}

async function fetchNewsContext(): Promise<NewsContextResult> {
    try {
        console.log('[Brief] Fetching news context from Google News RSS...')
        const res = await fetch(GOOGLE_NEWS_RSS)
        const xml = await res.text()

        // Simple regex parse to avoid deps (robust enough for Google News RSS structure)
        const items = xml.match(/<item>[\s\S]*?<\/item>/g) || []
        console.log(`[Brief] Found ${items.length} RSS items`)

        const contextItems: string[] = []
        const sourceUrls: string[] = []

        items.slice(0, 20).forEach(item => {
            const title = item.match(/<title>(.*?)<\/title>/)?.[1] || ''
            const link = item.match(/<link>(.*?)<\/link>/)?.[1] || ''
            const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || ''
            const description = item.match(/<description>(.*?)<\/description>/)?.[1] || ''
                .replace(/<[^>]*>/g, '') // Strip HTML
                .replace('&nbsp;', ' ')

            contextItems.push(`Title: ${title}\nDate: ${pubDate}\nLink: ${link}\nContext: ${description}\n---`)
            if (link) sourceUrls.push(link)
        })

        return {
            context: contextItems.join('\n'),
            sourceUrls
        }
    } catch (e) {
        console.error('[Brief] Failed to fetch news context:', e)
        return { context: '', sourceUrls: [] }
    }
}

/**
 * Get source URLs from briefs created in the last N days
 */
async function getRecentBriefSourceUrls(days: number = 7): Promise<Set<string>> {
    try {
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - days)

        const recentBriefs = await db
            .select()
            .from(briefs)
            .where(sql`${briefs.generatedAt} >= ${cutoffDate}`)

        const urls = new Set<string>()
        for (const brief of recentBriefs) {
            const stories = brief.stories as BriefStory[]
            for (const story of stories) {
                if (story.sourceUrls) {
                    story.sourceUrls.forEach(url => urls.add(url))
                }
            }
        }

        return urls
    } catch (e) {
        console.error('[Brief] Failed to fetch recent brief URLs:', e)
        return new Set()
    }
}

export async function generateDailyBrief(): Promise<DailyBrief> {
    try {
        // 1. Get URLs already covered in recent briefs (last 7 days)
        const recentUrls = await getRecentBriefSourceUrls(7)
        console.log(`[Brief] Found ${recentUrls.size} source URLs in recent briefs (last 7 days)`)

        // 2. Fetch Real-time News Context
        const newsContextResult = await fetchNewsContext()

        if (!newsContextResult.context) {
            throw new Error('Failed to fetch current news context for analysis')
        }

        // 3. Filter out duplicate URLs
        const freshUrls = newsContextResult.sourceUrls.filter(url => !recentUrls.has(url))
        console.log(`[Brief] Filtered out ${newsContextResult.sourceUrls.length - freshUrls.length} duplicate URLs`)
        console.log(`[Brief] Sending ${freshUrls.length} fresh stories to AI for analysis`)

        if (freshUrls.length === 0) {
            console.warn('[Brief] ⚠️  No fresh stories available - all RSS items were already covered in recent briefs')
        }

        // Build context with only fresh URLs
        const freshContext = newsContextResult.context
            .split('---')
            .filter(item => {
                const linkMatch = item.match(/Link: (.*?)\n/)
                if (!linkMatch) return false
                return freshUrls.includes(linkMatch[1])
            })
            .join('---')

        const promptWithContext = `${DISCOVERY_PROMPT}\n\nREAL-TIME NEWS CONTEXT (LAST 24 HOURS - FRESH STORIES ONLY):\n${freshContext}`

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
            console.warn('[Brief] ⚠️  AI did not generate any stories from the available context')
            throw new Error('Failed to parse any stories from AI response (XML)')
        }

        console.log(`[Brief] ✓ Successfully generated ${stories.length} stories`)

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
        // Simply fetch the most recent brief (no time filtering to avoid timezone issues)
        const [brief] = await db
            .select()
            .from(briefs)
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
