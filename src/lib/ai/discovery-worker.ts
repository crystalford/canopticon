import { GoogleGenerativeAI } from '@google/generative-ai'
import { getSetting, SETTINGS_KEYS } from '@/lib/db-settings'
import { db, briefs } from '@/db'
import { desc } from 'drizzle-orm'

export interface BriefStory {
    headline: string
    summary: string
    keyPlayers: string[]
    significance: number
}

export interface DailyBrief {
    id: string
    generatedAt: Date
    stories: BriefStory[]
    status: 'draft' | 'published'
}

// Multiple RSS sources for better coverage
const NEWS_SOURCES = [
    'https://news.google.com/rss/search?q=Canada+politics+federal+when:1d&hl=en-CA&gl=CA&ceid=CA:en',
    'https://news.google.com/rss/search?q=Parliament+Canada+when:1d&hl=en-CA&gl=CA&ceid=CA:en',
    'https://news.google.com/rss/search?q=Trudeau+OR+Poilievre+when:1d&hl=en-CA&gl=CA&ceid=CA:en',
]

interface RssItem {
    title: string
    pubDate: Date
    description: string
}

/**
 * Check if a date is TODAY (in Eastern Time)
 */
/**
 * Check if a date is within the last 24 hours
 */
function isRecent(date: Date): boolean {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    return date >= twentyFourHoursAgo
}

/**
 * Fetch news from multiple sources and filter to TODAY only
 */
async function fetchTodaysNews(): Promise<RssItem[]> {
    console.log('[Brief] Fetching news from multiple sources...')
    const allItems: RssItem[] = []
    const seenTitles = new Set<string>()

    for (const url of NEWS_SOURCES) {
        try {
            const res = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                next: { revalidate: 0 }
            })
            const xml = await res.text()
            const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/g) || []

            for (const item of itemMatches) {
                const title = item.match(/<title>(.*?)<\/title>/)?.[1] || ''
                const pubDateStr = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || ''
                const description = (item.match(/<description>(.*?)<\/description>/)?.[1] || '')
                    .replace(/<[^>]*>/g, '')
                    .replace('&nbsp;', ' ')
                    .replace(/&amp;/g, '&')

                if (!title || seenTitles.has(title)) continue
                seenTitles.add(title)

                const pubDate = new Date(pubDateStr)

                // ONLY include items from the last 24 hours
                if (isRecent(pubDate)) {
                    allItems.push({ title, pubDate, description })
                }
            }
        } catch (e) {
            console.error(`[Brief] Failed to fetch ${url}:`, e)
        }
    }

    console.log(`[Brief] Found ${allItems.length} stories from TODAY`)

    // Sort by date, newest first
    allItems.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime())

    // Log top 5 for debugging
    allItems.slice(0, 5).forEach((item, i) => {
        console.log(`[Brief] #${i + 1}: ${item.title.substring(0, 50)}...`)
    })

    return allItems
}

const BRIEF_PROMPT = `You are a Political News Editor for a Canadian wire service.

Write news briefs from the provided TODAY'S NEWS HEADLINES.
Only write about stories that appear in the provided context.

For each of the top 5 most significant stories:
1. Write a clear, objective news article (300-500 words)
2. Identify key political players
3. Rate significance (1-10)

Style:
- Start with dateline city (e.g., "OTTAWA - ...")
- Professional, neutral tone (Reuters/CP style)
- Do NOT mention ratings or key players in the article text

Return ONLY valid XML:
<brief>
  <story>
    <headline>Clear Headline</headline>
    <summary>OTTAWA - Full article text here...</summary>
    <key_players>Name (Role), Name (Role)</key_players>
    <significance>8</significance>
  </story>
</brief>

CRITICAL: Return ONLY XML. No markdown.`

export async function generateDailyBrief(): Promise<DailyBrief> {
    try {
        // 1. Get TODAY's news only
        const todaysNews = await fetchTodaysNews()

        if (todaysNews.length === 0) {
            throw new Error('No news stories found for today. Try again later when more stories are published.')
        }

        // Build context from today's headlines
        const context = todaysNews
            .slice(0, 20)
            .map(item => `HEADLINE: ${item.title}\nCONTEXT: ${item.description}`)
            .join('\n\n---\n\n')

        const fullPrompt = `${BRIEF_PROMPT}\n\nTODAY'S NEWS (${new Date().toLocaleDateString('en-CA')}):\n\n${context}`

        // Get AI provider
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
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: 'claude-3-haiku-20240307',
                    max_tokens: 4096,
                    messages: [{ role: 'user', content: fullPrompt }]
                })
            })
            if (!response.ok) throw new Error(`Anthropic API error: ${await response.text()}`)
            const data = await response.json()
            responseText = data.content[0].text

        } else if (provider === 'gemini') {
            const genAI = new GoogleGenerativeAI(apiKey)
            const model = genAI.getGenerativeModel({
                model: 'gemini-2.0-flash-exp',
                generationConfig: { maxOutputTokens: 8000 }
            })
            const result = await model.generateContent(fullPrompt)
            responseText = result.response.text()

        } else {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [{ role: 'user', content: fullPrompt }],
                    max_tokens: 8000
                })
            })
            if (!response.ok) throw new Error(`OpenAI API error: ${await response.text()}`)
            const data = await response.json()
            responseText = data.choices[0].message.content
        }

        // Parse XML response
        const stories: BriefStory[] = []
        const storyMatches = responseText.match(/<story>[\s\S]*?<\/story>/g) || []

        for (const match of storyMatches) {
            const headline = match.match(/<headline>([\s\S]*?)<\/headline>/)?.[1]?.trim() || ''
            const summary = match.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.trim() || ''
            const significanceStr = match.match(/<significance>([\s\S]*?)<\/significance>/)?.[1]?.trim() || '5'
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
            throw new Error('AI failed to generate stories from today\'s news')
        }

        console.log(`[Brief] ✓ Generated ${stories.length} stories from today's news`)

        // Save to database
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
        console.error('[Brief] Failed to generate:', error)
        throw error
    }
}

export async function getTodaysBrief(): Promise<DailyBrief | null> {
    try {
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
        console.error('[Brief] Failed to fetch:', error)
        return null
    }
}
