
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

/**
 * reliable free search using Google News RSS
 */
async function searchGoogleNewsRSS(query: string): Promise<string> {
    const GOOGLE_NEWS_RSS_BASE = 'https://news.google.com/rss/search?q='
    const encodedQuery = encodeURIComponent(query + ' when:7d') // Last 7 days to keep it fresh

    const res = await fetch(`${GOOGLE_NEWS_RSS_BASE}${encodedQuery}&hl=en-CA&gl=CA&ceid=CA:en`)
    const xml = await res.text()

    // Robust Regex Parse
    const items = xml.match(/<item>[\s\S]*?<\/item>/g) || []

    if (items.length === 0) return `[No news found for: ${query}]`

    const snippets = items.slice(0, 3).map(item => {
        const title = item.match(/<title>(.*?)<\/title>/)?.[1] || ''
        const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || ''
        const link = item.match(/<link>(.*?)<\/link>/)?.[1] || ''

        // Description often contains HTML, strip it
        let description = item.match(/<description>(.*?)<\/description>/)?.[1] || ''
        description = description.replace(/<[^>]*>/g, '').replace('&nbsp;', ' ')

        return `SOURCE: ${title}
DATE: ${pubDate}
LINK: ${link}
SUMMARY: ${description}`
    })

    return `--- INTELLIGENCE ON: "${query}" ---\n${snippets.join('\n\n')}`
}
