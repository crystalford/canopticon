import Parser from 'rss-parser';
import { Signal } from '@/types';
import crypto from 'crypto';
import { SourceManager } from '@/lib/services/source-manager';

const parser = new Parser();

function generateHash(str: string): string {
    return crypto.createHash('md5').update(str).digest('hex');
}

export async function fetchAllFeeds(): Promise<Signal[]> {
    const allSignals: Signal[] = [];

    // Fetch sources from SourceManager (replaces direct Supabase call)
    const sources = await SourceManager.getActiveSources();

    if (!sources || sources.length === 0) {
        console.warn("No active sources found for ingestion.");
        return [];
    }

    // Process feeds in parallel
    const promises = sources.map(async (source) => {
        // Skip if not RSS (though getActiveSources returns all types, we should filter or SourceManager should handle types)
        if (source.source_type !== 'rss') return [];

        try {
            const feed = await parser.parseURL(source.url);

            // Record Success
            await SourceManager.recordSuccess(source.id);

            const signals: Signal[] = feed.items.map((item) => {
                const hash = generateHash(item.link || item.title || '');

                // Content extraction (fallback hierarchy)
                const rawContent = (item.content || item.contentSnippet || '').toLowerCase();
                const entities: string[] = [];
                // Simple Entity Recognition (Placeholder for better NLP)
                if (rawContent.includes('trudeau')) entities.push('Justin Trudeau');
                if (rawContent.includes('poilievre')) entities.push('Pierre Poilievre');
                if (rawContent.includes('housing')) entities.push('Housing');
                if (rawContent.includes('inflation')) entities.push('Inflation');

                return {
                    id: hash,
                    hash: hash,
                    source: source.name,
                    source_id: source.id, // Link to Source ID
                    headline: item.title || 'Untitled Signal',
                    url: item.link || '',
                    publishedAt: item.isoDate || new Date().toISOString(),
                    summary: item.contentSnippet || '',
                    priority: 'normal', // Default
                    status: 'pending',
                    entities: entities,
                    topics: [source.category || 'politics'],
                    raw_content: item.content
                };
            });

            return signals;
        } catch (error) {
            console.error(`Failed to fetch ${source.name}:`, error);
            // Record Failure
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
