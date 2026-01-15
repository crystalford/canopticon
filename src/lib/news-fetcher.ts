
const GOOGLE_NEWS_RSS_BASE = 'https://news.google.com/rss/search?q='

export async function fetchTopicContext(query: string): Promise<string> {
    try {
        const encodedQuery = encodeURIComponent(query + ' when:7d') // Last 7 days
        const res = await fetch(`${GOOGLE_NEWS_RSS_BASE}${encodedQuery}&hl=en-CA&gl=CA&ceid=CA:en`)
        const xml = await res.text()

        // Simple regex parse (same as discovery worker)
        const items = xml.match(/<item>[\s\S]*?<\/item>/g) || []

        return items.slice(0, 5).map(item => {
            const title = item.match(/<title>(.*?)<\/title>/)?.[1] || ''
            const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || ''
            const description = item.match(/<description>(.*?)<\/description>/)?.[1] || ''
                .replace(/<[^>]*>/g, '') // Strip HTML
                .replace('&nbsp;', ' ')

            return `[Title: ${title} | Date: ${pubDate} | Context: ${description}]`
        }).join('\n')
    } catch (e) {
        console.error('Failed to fetch topic context:', e)
        return ''
    }
}
