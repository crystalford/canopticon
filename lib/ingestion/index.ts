import { Signal } from '@/types';
import { fetchAllFeeds as fetchRSS } from './rss';
import { fetchParliamentBills } from './parliament';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function getGlobalSignals(): Promise<Signal[]> {
    // Parallel execution of all ingestion services
    try {
        const [rssSignals, parliamentSignals] = await Promise.all([
            fetchRSS(),
            fetchParliamentBills()
        ]);
        // console.log(`[Ingest] Fetched ${rssSignals.length} RSS, ${parliamentSignals.length} Bills`);

        const allSignals = [...parliamentSignals, ...rssSignals];
        // console.log(`[Ingest] Total Live Signals: ${allSignals.length}`);

        // 3. fetch existing signals first to preserve state
        let existingSignals: any[] = [];
        try {
            const { data } = await supabaseAdmin
                .from('signals')
                .select('hash, status, analysis, ai_summary, ai_script, ai_tags')
                .in('hash', allSignals.map(s => s.id));
            if (data) existingSignals = data;
        } catch (e) {
            console.error("Failed to fetch existing signals:", e);
        }

        // 4. Merge DB Status into allSignals AND Prepare Upsert list
        const dbMap = new Map(existingSignals.map(s => [s.hash, s]));
        const signalsToUpsert: any[] = [];

        allSignals.forEach(s => {
            const dbSignal = dbMap.get(s.id);
            if (dbSignal) {
                // Found in DB: Merge status and DO NOT add to upsert list (preserve DB source of truth)
                console.log(`[Ingest] Merging DB state for ${s.id}: ${dbSignal.status}`);
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
            } else {
                // Not in DB: Add to upsert list
                signalsToUpsert.push({
                    hash: s.id,
                    headline: s.headline,
                    summary: s.summary,
                    url: s.url,
                    source: s.source,
                    published_at: s.publishedAt,
                    priority: s.priority,
                    status: s.status, // Default pending
                    entities: s.entities,
                    topics: s.topics,
                    raw_content: s.rawContent
                });
            }
        });

        // 5. Upsert only NEW signals
        if (signalsToUpsert.length > 0) {
            try {
                const { error } = await supabaseAdmin.from('signals').upsert(
                    signalsToUpsert,
                    { onConflict: 'hash', ignoreDuplicates: true }
                );
                if (error) console.error("Failed to persist signals:", error);
                else console.log(`[Ingest] Persisted ${signalsToUpsert.length} new signals`);
            } catch (dbError) {
                console.warn("Database persistence exception");
            }
        }

        // Sort by date descending (Newest first)
        return allSignals.sort((a, b) =>
            new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
        );

    } catch (globalError) {
        console.error("CRITICAL INGESTION ERROR:", globalError);
        // Fallback: return what we have or empty
        return [];
    }
}
