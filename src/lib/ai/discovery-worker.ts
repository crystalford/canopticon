import { GoogleGenerativeAI } from '@google/generative-ai'
import { getSetting, SETTINGS_KEYS } from '@/lib/db-settings'
import { db, briefs, articles } from '@/db'
import { sql, desc } from 'drizzle-orm'

export interface BriefStory {
    headline: string
    summary: string // Full context (500-800 words)
    keyPlayers: string[]
    significance: number // 1-10
    rssTitle?: string // Original RSS headline that sourced this story
}

export interface DailyBrief {
    id: string
    generatedAt: Date
    stories: BriefStory[]
    status: 'draft' | 'published'
}

// Google News RSS for Canadian Politics (Last 24h)
const GOOGLE_NEWS_RSS = 'https://news.google.com/rss/search?q=Canadian+federal+politics+Parliament+Canada+when:1d&hl=en-CA&gl=CA&ceid=CA:en'

/**
 * Get headlines from articles AND briefs in the last N days.
 * These are stories we've already covered and should NOT generate again.
 */
async function getRecentCoveredHeadlines(days: number = 7): Promise<string[]> {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    const headlines: string[] = []

    // 1. Get headlines from published articles
    try {
        const recentArticles = await db
            .select({ headline: articles.headline })
            .from(articles)
            .where(sql`${articles.createdAt} >= ${cutoff}`)

        recentArticles.forEach(a => headlines.push(a.headline))
        console.log(`[Brief] Found ${recentArticles.length} articles from last ${days} days`)
    } catch (e) {
        console.error('[Brief] Failed to fetch article headlines:', e)
    }

    // 2. Get headlines from recent briefs (even if not published as articles)
    try {
        const recentBriefs = await db
            .select({ stories: briefs.stories })
            .from(briefs)
            .where(sql`${briefs.generatedAt} >= ${cutoff}`)

        recentBriefs.forEach(brief => {
            const stories = brief.stories as BriefStory[]
            stories.forEach(story => {
                if (story.headline && !headlines.includes(story.headline)) {
                    headlines.push(story.headline)
                }
            })
        })
        console.log(`[Brief] Found ${recentBriefs.length} briefs from last ${days} days`)
    } catch (e) {
        console.error('[Brief] Failed to fetch brief headlines:', e)
    }

    console.log(`[Brief] Total ${headlines.length} headlines to exclude`)
    return headlines
}

interface RssItem {
    title: string
    link: string
    pubDate: string
    description: string
}

async function fetchNewsContext(): Promise<{ items: RssItem[], context: string }> {
    try {
        console.log('[Brief] Fetching news context from Google News RSS...')
        const res = await fetch(GOOGLE_NEWS_RSS)
        const xml = await res.text()

        // Simple regex parse to avoid deps (robust enough for Google News RSS structure)
        const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/g) || []
        console.log(`[Brief] Found ${itemMatches.length} RSS items`)

        const items: RssItem[] = []
        const contextParts: string[] = []

        itemMatches.slice(0, 25).forEach(item => {
            const title = item.match(/<title>(.*?)<\/title>/)?.[1] || ''
            const link = item.match(/<link>(.*?)<\/link>/)?.[1] || ''
            const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || ''
            const description = (item.match(/<description>(.*?)<\/description>/)?.[1] || '')
                .replace(/<[^>]*>/g, '') // Strip HTML
                .replace('&nbsp;', ' ')

            items.push({ title, link, pubDate, description })
            contextParts.push(`Title: ${title}\nDate: ${pubDate}\nContext: ${description}\n---`)
        })

        return {
            items,
            context: contextParts.join('\n')
        }
    } catch (e) {
        console.error('[Brief] Failed to fetch news context:', e)
        return { items: [], context: '' }
    }
}

function buildPrompt(newsContext: string, excludeHeadlines: string[]): string {
    const basePrompt = `You are a Political News Editor for a Canadian wire service (CP Style).

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

    // Build exclusion list from published headlines
    let exclusionClause = ''
    if (excludeHeadlines.length > 0) {
        exclusionClause = `

⚠️ CRITICAL - DO NOT WRITE ABOUT THESE ALREADY-PUBLISHED STORIES:
${excludeHeadlines.map(h => `• ${h}`).join('\n')}

These topics have already been covered. Find DIFFERENT news events in the context.
If ALL news in the context relates to these excluded topics, return fewer stories or stories about DIFFERENT aspects not yet covered.`
    }

    return `${basePrompt}${exclusionClause}

REAL-TIME NEWS CONTEXT (LAST 24 HOURS):
${newsContext}`
}

export async function generateDailyBrief(): Promise<DailyBrief> {
    try {
        // 1. Get headlines we've already covered (from both articles AND briefs, last 7 days)
        const coveredHeadlines = await getRecentCoveredHeadlines(7)

        if (coveredHeadlines.length > 0) {
            console.log(`[Brief] Excluding ${coveredHeadlines.length} already-covered stories:`)
            coveredHeadlines.forEach((h: string) => console.log(`  - ${h}`))
        }

        // 2. Fetch real-time news context
        const { items, context } = await fetchNewsContext()

        if (!context) {
            throw new Error('Failed to fetch current news context for analysis')
        }

        // 3. Build prompt with exclusion list
        const fullPrompt = buildPrompt(context, coveredHeadlines)

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
                        content: fullPrompt
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

            const result = await model.generateContent(fullPrompt)
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
                        content: fullPrompt
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

            if (headline && summary) {
                stories.push({
                    headline,
                    summary,
                    significance: parseInt(significanceStr) || 5,
                    keyPlayers: playersStr.split(',').map(s => s.trim()).filter(s => s),
                })
            }
        }

        if (stories.length === 0) {
            console.warn('[Brief] ⚠️  AI did not generate any stories from the available context')
            throw new Error('Failed to parse any stories from AI response (XML)')
        }

        console.log(`[Brief] ✓ Successfully generated ${stories.length} NEW stories`)

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
