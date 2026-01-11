import { Signal } from '@/types';
import { fetchAllFeeds as fetchRSS } from './rss';
import { fetchParliamentBills } from './parliament';
import { supabase } from '@/lib/supabase';

export async function getGlobalSignals(): Promise<Signal[]> {
    // Parallel execution of all ingestion services
    const [rssSignals, parliamentSignals] = await Promise.all([
        fetchRSS(),
        fetchParliamentBills()
    ]);

    const allSignals = [...parliamentSignals, ...rssSignals];

    // Persist to Database (Fire and Forget to not slow down UI too much, 
    // or await if we want strict consistency)
    // We use upsert based on 'id' or 'hash' to avoid duplicates.
    const { error } = await supabase.from('signals').upsert(
        allSignals.map(s => ({
            hash: s.id, // Using ID as hash for uniqueness
            headline: s.headline,
            summary: s.summary,
            url: s.url,
            source: s.source,
            published_at: s.publishedAt,
            priority: s.priority,
            status: s.status,
            entities: s.entities,
            topics: s.topics,
            raw_content: s.rawContent ? JSON.parse(s.rawContent as string) : null
        })),
        { onConflict: 'hash', ignoreDuplicates: true }
    );

    if (error) {
        console.error("Failed to persist signals:", error);
    }

    // Sort by date descending (Newest first)
    return allSignals.sort((a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
}
