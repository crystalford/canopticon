"use server"

import { analyzeSignal } from '@/lib/analysis/ai'
import { generateThumbnail, generateAudio } from '@/lib/content/media'
import { generateXThread, generateSubstackArticle } from '@/lib/content/formatters'
import { supabase } from '@/lib/supabase'
import { Signal } from '@/types' // Assuming Signal type is needed if we pass full object, checking imports

// ... existing media actions ...

import { savePublication, getPublications } from '@/lib/content/persistence'

export async function updateSignalStatusAction(signalId: string, status: 'pending' | 'processing' | 'published' | 'archived') {
  await supabase
    .from('signals')
    .update({ status })
    .eq('hash', signalId);
}


export async function getSignalPublicationsAction(signalHash: string) {
  const pubs = await getPublications(signalHash);
  return pubs;
}

export async function generateXThreadAction(signal: any, analysis: any) {
  const thread = await generateXThread(signal, analysis);
  if (thread) {
    await savePublication(signal.id, 'thread', thread);
  }
  return thread;
}

export async function generateArticleAction(signal: any, analysis: any) {
  const article = await generateSubstackArticle(signal, analysis);
  if (article) {
    await savePublication(signal.id, 'article', article);
  }
  return article;
}


export async function generateMediaAction(headline: string, script: string) {
  // This action can be called to generate either or both, for now let's expose separate ones or a combined one?
  // Let's do separate to give user control.
}

export async function generateImageAction(signalHash: string, headline: string) {
  const imageUrl = await generateThumbnail(headline);
  if (imageUrl) {
    await savePublication(signalHash, 'image', imageUrl);
  }
  return imageUrl;
}

export async function generateAudioAction(signalHash: string, script: string) {
  const audioUrl = await generateAudio(script);
  if (audioUrl) {
    await savePublication(signalHash, 'audio', audioUrl);
  }
  return audioUrl;
}


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
