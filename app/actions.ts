"use server"

import { analyzeSignal } from '@/lib/analysis/ai'
import { supabase } from '@/lib/supabase'

export async function analyzeSignalAction(headline: string, content: string) {
  const result = await analyzeSignal(headline, content);

  // Try to find the signal in DB to update it
  // We search by headline/content hash or just headline for now since we don't have ID passed easily
  // Ideally we pass ID, but for now we trust the flow.
  // Actually, let's just use the logic: if we analyzed it, we want to store it.

  // Update the signal in the DB with the new analysis
  // We need to match it against an existing record.
  // Strategy: We will update where headline matches.
  await supabase.from('signals')
    .update({
      ai_summary: result.summary,
      ai_script: result.script,
      ai_tags: result.tags
    })
    .eq('headline', headline);

  return result;
}
