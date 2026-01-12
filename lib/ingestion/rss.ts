import Parser from 'rss-parser';
import { Signal } from '@/types';
import crypto from 'crypto';
import { supabase } from '@/lib/supabase';

const parser = new Parser();

function generateHash(str: string): string {
    return crypto.createHash('md5').update(str).digest('hex');
}

export async function fetchAllFeeds(): Promise<Signal[]> {
    const allSignals: Signal[] = [];

    // Fetch sources from Supabase
    const { data: sources, error } = await supabase
        .from('sources')
        .select('*')
        .eq('active', true);

    if (error || !sources) {
        console.error("Failed to fetch RSS sources:", error);
        return [];
    }

    const promises = sources.map(async (source) => {
        try {
            const feed = await parser.parseURL(source.url);

            const signals: Signal[] = feed.items.map((item) => {
                const hash = generateHash(item.link || item.title || '');

                // Content extraction (fallback hierarchy)
                const rawContent = (item.content || item.contentSnippet || '').toLowerCase();
                const entities: string[] = [];
                // Simple Entity Recognition
                if (rawContent.includes('trudeau')) entities.push('Justin Trudeau');
                if (rawContent.includes('poilievre')) entities.push('Pierre Poilievre');
                if (rawContent.includes('housing')) entities.push('Housing');
                if (rawContent.includes('inflation')) entities.push('Inflation');

                return {
                    id: hash,
                    hash: hash,
                    headline: item.title || 'Untitled Signal',
                    url: item.link || '',
                    source: source.name,
                    publishedAt: item.isoDate || new Date().toISOString(),
                    summary: item.contentSnippet || '',
                    priority: 'medium',
                    status: 'pending',
                    entities: entities,
                    topics: [source.category || 'politics'],
                    rawContent: item.content
                };
            });

            return signals;
        } catch (error) {
            console.error(`Failed to fetch ${source.name}:`, error);
            return [];
        }
    });

    const results = await Promise.all(promises);
    results.forEach(batch => allSignals.push(...batch));

    return allSignals.sort((a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
}
