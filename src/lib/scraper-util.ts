/**
 * Pure Scraper Utility
 * Does NOT depend on Database or other heavy modules.
 */

export async function extractArticleContent(url: string): Promise<{
    title: string
    bodyText: string
    publishedAt?: Date
} | null> {
    try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 8000) // 8s fetch timeout

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'CANOPTICON/1.0 (Political Research Bot)',
            },
            signal: controller.signal
        })
        clearTimeout(timeoutId)

        if (!response.ok) {
            console.error(`Failed to fetch URL: ${response.status} ${response.statusText}`)
            return null
        }

        const html = await response.text()

        // Basic extraction
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
        const title = titleMatch?.[1]?.trim() || 'Untitled'

        // Extract text from body
        let bodyText = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()

        bodyText = bodyText.slice(0, 10000)

        return { title, bodyText }

    } catch (error) {
        console.error('Article extraction failed:', error)
        return null
    }
}
