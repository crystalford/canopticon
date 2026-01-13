'use server'

import { supabase } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { ingestRSS } from '@/lib/simple-ingest'

export async function approveSignal(id: string) {
    const { error } = await supabase
        .from('signals')
        .update({ status: 'published' })
        .eq('id', id)

    if (error) {
        return { success: false, error: error.message }
    }

    revalidatePath('/admin/review')
    revalidatePath('/admin/content')
    return { success: true }
}

export async function deleteSignal(id: string) {
    // HARD DELETE - gone forever
    const { error } = await supabase
        .from('signals')
        .delete()
        .eq('id', id)

    if (error) {
        return { success: false, error: error.message }
    }

    revalidatePath('/admin/review')
    return { success: true }
}

export async function runIngest() {
    // Get all active sources
    const { data: sources } = await supabase
        .from('sources')
        .select('*')
        .eq('active', true)
        .order('priority')

    if (!sources || sources.length === 0) {
        return { success: false, error: 'No active sources' }
    }

    let totalCount = 0

    for (const source of sources) {
        const result = await ingestRSS(source.url, source.name)
        if (result.success) {
            totalCount += result.count
        }
    }

    revalidatePath('/admin/review')
    return { success: true, count: totalCount }
}
