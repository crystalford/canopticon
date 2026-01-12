import axios from 'axios';
import * as cheerio from 'cheerio';

export interface ArticleFetchResult {
    content: string;
    wordCount: number;
    success: boolean;
    error?: string;
}

/**
 * Fetches the full article content from a URL by scraping the HTML
 * @param url - The URL of the article to fetch
 * @returns ArticleFetchResult with content, word count, and success status
 */
export async function fetchFullArticle(url: string): Promise<ArticleFetchResult> {
    try {
        // Fetch HTML with realistic user agent
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 10000, // 10 second timeout
            maxRedirects: 5
        });

        const $ = cheerio.load(response.data);

        // Remove unwanted elements
        $('script').remove();
        $('style').remove();
        $('nav').remove();
        $('header').remove();
        $('footer').remove();
        $('.advertisement').remove();
        $('.ad').remove();
        $('.social-share').remove();

        // Try multiple common selectors for article content
        let articleContent = '';

        // Common article selectors (in order of specificity)
        const selectors = [
            'article',
            '[role="article"]',
            '.article-content',
            '.post-content',
            '.entry-content',
            '.story-body',
            '.article-body',
            'main article',
            'main',
            '.content'
        ];

        for (const selector of selectors) {
            const element = $(selector);
            if (element.length > 0) {
                articleContent = element.text();
                break;
            }
        }

        // Fallback: get body text if no article found
        if (!articleContent || articleContent.trim().length < 100) {
            articleContent = $('body').text();
        }

        // Clean up the text
        const cleanedContent = articleContent
            .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
            .replace(/\n+/g, '\n') // Replace multiple newlines with single newline
            .trim();

        const wordCount = cleanedContent.split(/\s+/).length;

        // Validate we got meaningful content
        if (wordCount < 50) {
            return {
                content: '',
                wordCount: 0,
                success: false,
                error: 'Content too short - likely failed to extract article'
            };
        }

        return {
            content: cleanedContent,
            wordCount,
            success: true
        };

    } catch (error: any) {
        console.error('Error fetching article:', url, error.message);
        return {
            content: '',
            wordCount: 0,
            success: false,
            error: error.message || 'Unknown error'
        };
    }
}

/**
 * Check if RSS feed item has full content already
 * Some feeds provide full content in content:encoded
 */
export function hasFullContent(rssContent: string): boolean {
    if (!rssContent) return false;
    const wordCount = rssContent.split(/\s+/).length;
    return wordCount > 200; // Arbitrary threshold for "full" content
}
