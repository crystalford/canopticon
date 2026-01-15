
/**
 * Research Module
 * 
 * Modular function to perform live research based on queries.
 * Currently implements a robust reliable fallback using Google News RSS.
 * Ready for drop-in replacement with Serper/Tavily APIs.
 */

const ADAPTER = 'google_news_rss' // 'google_news_rss' | 'tavily' | 'serper'

export async function performLiveResearch(queries: string[]): Promise<string> {
    console.log(`[Research] Starting investigation for queries: ${queries.join(', ')}`)

    // Fan-out search requests
    const results = await Promise.all(queries.map(q => searchGeneric(q)))

    // Deduplicate and format
    return results.join('\n\n')
}

async function searchGeneric(query: string): Promise<string> {
    try {
        if (ADAPTER === 'google_news_rss') {
            return await searchGoogleNewsRSS(query)
        }
        // Future adapters:
        // if (ADAPTER === 'tavily') return await searchTavily(query)

        return `[Mock Result for: ${query}]`
    } catch (error) {
        console.error(`[Research] Failed to search for "${query}":`, error)
        return `[Error fetching context for: ${query}]`
    }
}

import { extractArticleContent } from './ingestion/manual-worker'

/**
 * reliable free search using Google News RSS + Deep Content Fetch via Scraper
 */
async function searchGoogleNewsRSS(query: string): Promise<string> {
    const GOOGLE_NEWS_RSS_BASE = 'https://news.google.com/rss/search?q='
    const encodedQuery = encodeURIComponent(query + ' when:7d') // Last 7 days to keep it fresh

    const res = await fetch(`${GOOGLE_NEWS_RSS_BASE}${encodedQuery}&hl=en-CA&gl=CA&ceid=CA:en`)
    const xml = await res.text()

    // Robust Regex Parse
    const items = xml.match(/<item>[\s\S]*?<\/item>/g) || []

    if (items.length === 0) return `[No news found for: ${query}]`

    // Process top 3 items
    const topItems = items.slice(0, 3).map(item => {
        const title = item.match(/<title>(.*?)<\/title>/)?.[1] || ''
        const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || ''
        const link = item.match(/<link>(.*?)<\/link>/)?.[1] || ''

        let description = item.match(/<description>(.*?)<\/description>/)?.[1] || ''
        description = description.replace(/<[^>]*>/g, '').replace('&nbsp;', ' ')

        return { title, pubDate, link, description }
    })

    // DEEP DIVE: Fetch full content for the top 2 results
    const deepDivePromise = topItems.slice(0, 2).map(async (item) => {
        try {
            if (!item.link) return null
            console.log(`[Research] Deep fetching: ${item.link}`)
            const content = await extractArticleContent(item.link)
            if (content && content.bodyText.length > 500) {
                return {
                    ...item,
                    fullText: content.bodyText.slice(0, 5000) // 5KB limit per article
                }
            }
        } catch (e) {
            console.warn(`[Research] Failed to fetch content for ${item.link}`, e)
        }
        return item
    })

    const enrichedItems = await Promise.all(deepDivePromise)

    return `--- INTELLIGENCE ON: "${query}" ---\n` + enrichedItems.map(item => {
        if (!item) return ''
        const content = item.fullText
            ? `\n\n[FULL CONTENT EXTRACTED]:\n${item.fullText}\n`
            : `\n\n[SNIPPET ONLY]: ${item.description}`

        return `SOURCE: ${item.title}\nDATE: ${item.pubDate}\nLINK: ${item.link}${content}`
    }).join('\n\n' + '='.repeat(40) + '\n\n')
}
