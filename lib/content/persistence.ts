import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { Publication, PublicationType } from '@/types';

export async function savePublication(signalHash: string, type: PublicationType, content: any): Promise<Publication | null> {
    try {
        const { data, error } = await supabaseAdmin
            .from('publications')
            .upsert({
                signal_hash: signalHash,
                type: type,
                content: content,
                // created_at defaults to now() in DB usually, but we can pass it if we want strict control
            }, { onConflict: 'signal_hash, type' }) // Ensure only one of each type per signal for now? Or allow multiples? For MVP, one per signal is cleaner.
            .select()
            .single();

        if (error) {
            console.error(`Error saving publication (${type}):`, error);
            // Fallback for missing table: return a mock object so UI doesn't crash, 
            // but log clearly that persistence failed.
            if (error.code === '42P01') { // undefined_table
                console.warn("Table 'publications' does not exist. Skipping persistence.");
                return null;
            }
            return null;
        }

        return data as Publication;
    } catch (e) {
        console.error("Persistence Exception:", e);
        return null;
    }
}

export async function getPublications(signalHash: string): Promise<Publication[]> {
    try {
        const { data, error } = await supabase
            .from('publications')
            .select('*')
            .eq('signal_hash', signalHash);

        if (error) {
            // undefined_table check
            if (error.code === '42P01') {
                return [];
            }
            console.error("Error fetching publications:", error);
            return [];
        }

        return data as Publication[] || [];
    } catch (e) {
        console.error("Fetch Exception:", e);
        return [];
    }
}
