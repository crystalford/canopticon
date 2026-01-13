/**
 * Article content fetcher using Jina AI Reader API
 * Much simpler and more reliable than web scraping
 */

export interface ArticleFetchResult {
    success: boolean;
    content: string;
    wordCount: number;
    error?: string;
}

/**
 * Fetch full article content using Jina AI Reader
 * @param url - Article URL to fetch
 * @returns Article content and metadata
 */
export async function fetchFullArticle(url: string): Promise<ArticleFetchResult> {
    if (!url || url.trim() === '') {
        return {
            success: false,
            content: '',
            wordCount: 0,
            error: 'Empty URL provided'
        };
    }

    try {
        // Use Jina AI Reader API
        // Added aggressive Timeout and fallback handling
        const jinaUrl = `https://r.jina.ai/${url}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const response = await fetch(jinaUrl, {
            headers: {
                'Accept': 'text/plain',
                'X-Return-Format': 'text',
                'User-Agent': "Canopticon/1.0"
            },
            signal: controller.signal,
            next: { revalidate: 3600 }
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            console.warn(`[Jina] HTTP Error ${response.status} for ${url}`);
            return {
                success: false,
                content: '',
                wordCount: 0,
                error: `HTTP ${response.status}: ${response.statusText}`
            };
        }

        const content = await response.text();
        const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;

        // Validation - Jina sometimes returns error HTML
        if (content.includes("Cloudflare") || content.includes("Access denied")) {
            console.warn(`[Jina] Blocked by Cloudflare/Bot-detection: ${url}`);
            return { success: false, content: '', wordCount: 0, error: "Blocked" };
        }

        if (wordCount < 50) {
            return {
                success: false,
                content: '',
                wordCount: 0,
                error: `Content too short (${wordCount} words)`
            };
        }

        return {
            success: true,
            content: content.trim(),
            wordCount,
        };

    } catch (error: any) {
        console.error(`[Jina] Exception fetching ${url}:`, error.message);
        return {
            success: false,
            content: '',
            wordCount: 0,
            error: error.message || 'Unknown fetch error'
        };
    }
}
