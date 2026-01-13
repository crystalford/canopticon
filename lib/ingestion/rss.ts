import Parser from 'rss-parser';
import { Signal } from '@/types';
import crypto from 'crypto';
import { SourceManager } from '@/lib/services/source-manager';
import { calculateBasicConfidence } from './confidence';
import { fetchFullArticle } from './article-fetcher';

const parser = new Parser();

function generateHash(str: string): string {
    return crypto.createHash('md5').update(str).digest('hex');
}

export async function fetchAllFeeds(): Promise<Signal[]> {
    const allSignals: Signal[] = [];

    // Fetch sources from SourceManager
    const sources = await SourceManager.getActiveSources();

    if (!sources || sources.length === 0) {
        console.warn("No active sources found for ingestion.");
        return [];
    }

    // Process feeds in parallel
    const promises = sources.map(async (source) => {
        if (source.source_type !== 'rss') return [];

        try {
            const feed = await parser.parseURL(source.url);
            await SourceManager.recordSuccess(source.id);

            // Process each feed item and fetch full content
            const signals = await Promise.all(feed.items.slice(0, 10).map(async (item) => {
                const hash = generateHash(item.link || item.guid || item.title || new Date().toISOString());

                let fullContent = '';
                let wordCount = 0;

                // Check if RSS already has full content
                const rssContent = item['content:encoded'] || item.content || '';
                const rssWordCount = rssContent.split(/\s+/).length;

                if (rssWordCount > 200) {
                    // RSS has sufficient content
                    fullContent = rssContent;
                    wordCount = rssWordCount;
                    console.log(`✓ Using RSS content for "${item.title}" (${wordCount} words)`);
                } else {
                    // Fetch full article from URL
                    console.log(`→ Fetching "${item.title}"...`);
                    const fetchResult = await fetchFullArticle(item.link || '');

                    if (fetchResult.success) {
                        fullContent = fetchResult.content;
                        wordCount = fetchResult.wordCount;
                        console.log(`✓ Fetched ${wordCount} words`);
                    } else {
                        fullContent = rssContent;
                        wordCount = rssWordCount;
                        console.log(`⚠ Using RSS summary (${wordCount} words)`);
                    }
                }

                const rawContent = fullContent || item.contentSnippet || '';

                // Entity extraction
                const entities = [];
                if (rawContent.toLowerCase().includes('trudeau')) entities.push('Justin Trudeau');
                if (rawContent.toLowerCase().includes('parliament')) entities.push('Parliament');
                if (rawContent.toLowerCase().includes('inflation')) entities.push('Inflation');

                return {
                    id: hash,
                    hash: hash,
                    source: source.name,
                    source_id: source.id,
                    headline: item.title || 'Untitled Signal',
                    url: item.link || '',
                    publishedAt: item.isoDate || new Date().toISOString(),
                    summary: item.contentSnippet || '',
                    priority: 'normal' as const,
                    status: 'draft' as const,
                    entities: entities,
                    topics: [source.category || 'politics'],
                    raw_content: rawContent, // Full article content!
                    metadata: {
                        word_count: wordCount,
                        content_source: wordCount > 200 ? 'fetched' : 'rss'
                    },
                    confidence_score: calculateBasicConfidence(
                        {
                            id: hash,
                            headline: item.title || '',
                            summary: item.contentSnippet || '',
                            publishedAt: item.isoDate || new Date().toISOString()
                        } as Signal,
                        source.reliability_score || 70
                    )
                };
            }));

            return signals;
        } catch (error) {
            console.error(`Failed to fetch ${source.name}:`, error);
            await source.id ? SourceManager.recordFailure(source.id) : null;
            return [];
        }
    });

    const results = await Promise.all(promises);
    results.forEach(batch => allSignals.push(...batch));

    return allSignals.sort((a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
}
