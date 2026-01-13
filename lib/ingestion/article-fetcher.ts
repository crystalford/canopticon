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
        // Use Jina AI Reader API - free tier allows 20k requests/day
        const jinaUrl = `https://r.jina.ai/${url}`;

        const response = await fetch(jinaUrl, {
            headers: {
                'Accept': 'text/plain',
                'X-Return-Format': 'text'
            },
            signal: AbortSignal.timeout(10000) // 10 second timeout
        });

        if (!response.ok) {
            return {
                success: false,
                content: '',
                wordCount: 0,
                error: `HTTP ${response.status}: ${response.statusText}`
            };
        }

        const content = await response.text();
        const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;

        // Validate we got meaningful content
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
        return {
            success: false,
            content: '',
            wordCount: 0,
            error: error.message || 'Unknown fetch error'
        };
    }
}
