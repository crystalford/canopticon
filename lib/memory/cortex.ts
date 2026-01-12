import { supabase } from '@/lib/supabase';
import { generateEmbedding } from './embedding';

export interface Memory {
    id: string;
    content: string;
    metadata: any;
    similarity?: number;
}

export async function storeMemory(content: string, metadata: any = {}, signalId?: string): Promise<boolean> {
    const vector = await generateEmbedding(content);
    if (!vector) return false;

    const { error } = await supabase
        .from('memory_vectors')
        .insert({
            content,
            metadata,
            embedding: vector,
            signal_id: signalId
        });

    if (error) {
        console.error("Cortex Store Failed:", error);
        return false;
    }
    return true;
}

export async function recallMemories(query: string, threshold = 0.5, limit = 5): Promise<Memory[]> {
    const vector = await generateEmbedding(query);
    if (!vector) return [];

    const { data, error } = await supabase.rpc('match_memories', {
        query_embedding: vector,
        match_threshold: threshold,
        match_count: limit
    });

    if (error) {
        console.error("Cortex Recall Failed:", error);
        return [];
    }

    return data || [];
}
