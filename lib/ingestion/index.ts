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

        const allSignals = [...parliamentSignals, ...rssSignals];

        // 3. fetch existing signals first to preserve state
        let existingSignals: any[] = [];
        try {
            const { data } = await supabaseAdmin
                .from('signals')
                .select('hash, status, metadata, ai_summary, ai_script, ai_tags')
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
                // We typically do NOT update existing signals on every ingest to save DB writes,
                // unless we want to update metadata or implementation changed.
                // For MVP, we skip existing.
                console.log(`[Ingest] Signal exists: ${s.id} (${dbSignal.status})`);
            } else {
                // Not in DB: Add to upsert list
                signalsToUpsert.push({
                    hash: s.id,
                    headline: s.headline,
                    summary: s.summary,
                    url: s.url,
                    source: s.source,
                    source_id: s.source_id,
                    published_at: s.publishedAt,
                    priority: s.priority || 'normal',
                    status: s.status, // Default pending
                    entities: s.entities,
                    topics: s.topics,
                    confidence_score: s.confidence_score,
                    signal_type: s.signal_type,
                    // Wrap in object to ensure it's valid JSONB
                    raw_content: { content: s.raw_content || '' }
                });
            }
        });

        // 5. Upsert only NEW signals
        if (signalsToUpsert.length > 0) {
            try {
                console.log(`[Ingest] Attempting to upsert ${signalsToUpsert.length} signals`);

                const { error } = await supabaseAdmin.from('signals').upsert(
                    signalsToUpsert,
                    { onConflict: 'hash', ignoreDuplicates: true }
                );

                if (error) {
                    console.error("Failed to persist signals:", error);
                } else {
                    console.log(`[Ingest] Persisted ${signalsToUpsert.length} new signals`);
                }
            } catch (dbError: any) {
                console.error("Database persistence exception:", dbError);
            }
        }

        // Sort by date descending (Newest first)
        return allSignals.sort((a, b) =>
            new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
        );

    } catch (globalError) {
        console.error("CRITICAL INGESTION ERROR:", globalError);
        return [];
    }
}
