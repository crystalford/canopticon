import Parser from 'rss-parser';
import { Signal } from '@/types';
import crypto from 'crypto';

const parser = new Parser();

const SOURCES = [
    { name: 'CBC Politics', url: 'https://www.cbc.ca/cmlink/rss-politics' },
    { name: 'Global News Politics', url: 'https://globalnews.ca/politics/feed/' },
    { name: 'CTV News Politics', url: 'https://www.ctvnews.ca/rss/ctvnews-ca-politics-public-xml-1.822302' }
];

function generateHash(str: string): string {
    return crypto.createHash('md5').update(str).digest('hex');
}

export async function fetchAllFeeds(): Promise<Signal[]> {
    const allSignals: Signal[] = [];

    const promises = SOURCES.map(async (source) => {
        try {
            const feed = await parser.parseURL(source.url);

            const signals: Signal[] = feed.items.map((item) => {
                const hash = generateHash(item.link || item.title || '');

                // Basic Entity Extraction (Naive implementation for MVP)
                const content = (item.content || item.contentSnippet || '').toLowerCase();
                const entities: string[] = [];
                if (content.includes('trudeau')) entities.push('Justin Trudeau');
                if (content.includes('poilievre')) entities.push('Pierre Poilievre');
                if (content.includes('jagmeet') || content.includes('singh')) entities.push('Jagmeet Singh');
                if (content.includes('housing')) entities.push('Housing');
                if (content.includes('inflation')) entities.push('Inflation');
                if (content.includes('tax')) entities.push('Tax');

                return {
                    id: hash,
                    hash: hash,
                    headline: item.title || 'Untitled Signal',
                    url: item.link || '',
                    source: source.name,
                    publishedAt: item.isoDate || new Date().toISOString(),
                    summary: item.contentSnippet || '',
                    priority: 'medium', // Default
                    status: 'pending',
                    entities: entities,
                    topics: [],
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

    // Sort by date descending
    return allSignals.sort((a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
}
