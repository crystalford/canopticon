import { supabaseAdmin } from '@/lib/supabase-admin';
import { Source } from '@/types';

export class SourceManager {

    /**
     * Fetch all active sources required for ingestion
     */
    static async getActiveSources(): Promise<Source[]> {
        const { data, error } = await supabaseAdmin
            .from('sources')
            .select('*')
            .eq('active', true)
            .eq('auto_disabled', false);

        if (error) {
            console.error('SourceManager: Failed to fetch active sources', error);
            return [];
        }

        return data as Source[];
    }

    /**
     * Record a successful ingestion event for a source
     */
    static async recordSuccess(sourceId: string) {
        await supabaseAdmin
            .from('sources')
            .update({
                last_successful_ingest: new Date().toISOString(),
                last_ingested_at: new Date().toISOString(),
                consecutive_failures: 0,
                error_count: 0 // Reset error count on success (optional policy)
            })
            .eq('id', sourceId);
    }

    /**
     * Record a failure event and auto-disable if threshold reached
     */
    static async recordFailure(sourceId: string, errorDetails?: string) {
        // First, fetch current failure count
        const { data: source } = await supabaseAdmin
            .from('sources')
            .select('consecutive_failures')
            .eq('id', sourceId)
            .single();

        if (!source) return;

        const newFailures = (source.consecutive_failures || 0) + 1;
        const shouldDisable = newFailures >= 5; // Disable after 5 consecutive fails

        const updates: any = {
            consecutive_failures: newFailures,
            last_ingested_at: new Date().toISOString(),
        };

        if (shouldDisable) {
            updates.auto_disabled = true;
            console.warn(`SourceManager: Auto-disabling source ${sourceId} due to ${newFailures} failures.`);
        }

        await supabaseAdmin
            .from('sources')
            .update(updates)
            .eq('id', sourceId);

        // Log detailed error to intake_logs if needed (can be separate logging service)
    }
}
