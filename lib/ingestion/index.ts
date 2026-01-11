import { Signal } from '@/types';
import { fetchAllFeeds as fetchRSS } from './rss';
import { fetchParliamentBills } from './parliament';

export async function getGlobalSignals(): Promise<Signal[]> {
    // Parallel execution of all ingestion services
    const [rssSignals, parliamentSignals] = await Promise.all([
        fetchRSS(),
        fetchParliamentBills()
    ]);

    const allSignals = [...parliamentSignals, ...rssSignals];

    // Sort by date descending (Newest first)
    return allSignals.sort((a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
}
