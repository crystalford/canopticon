import { Signal } from '@/types';
import { fetchAllFeeds as fetchRSS } from './rss';
import { fetchParliamentBills } from './parliament';
import { supabaseAdmin } from '@/lib/supabase-admin';

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
    try {
        const { error } = await supabaseAdmin.from('signals').upsert(
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
    } catch (dbError) {
        console.warn("Database persistence skipped (likely missing keys)");
    }

    // 4. Merge DB Status state into fresh signals
    try {
        const { data: existingSignals } = await supabaseAdmin
            .from('signals')
            .select('hash, status, analysis, ai_summary, ai_script, ai_tags')
            .in('hash', allSignals.map(s => s.id));
        if (existingSignals) {
            // @ts-ignore
            const dbMap = new Map(existingSignals.map(s => [s.hash, s]));

            allSignals.forEach(s => {
                const dbSignal = dbMap.get(s.id);
                if (dbSignal) {
                    // @ts-ignore
                    s.status = dbSignal.status;
                    // @ts-ignore
                    if (dbSignal.ai_summary) s.ai_summary = dbSignal.ai_summary;
                    // @ts-ignore
                    if (dbSignal.ai_script) s.ai_script = dbSignal.ai_script;
                    // @ts-ignore
                    if (dbSignal.ai_tags) s.ai_tags = dbSignal.ai_tags;
                    // @ts-ignore
                    if (dbSignal.analysis) s.analysis = dbSignal.analysis;
                }
            });
        }
    } catch (e) {
        console.error("Failed to merge DB state:", e);
    }

    // Sort by date descending (Newest first)
    return allSignals.sort((a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
}
