"use server"

import { analyzeSignal } from '@/lib/analysis/ai'
import { generateThumbnail, generateAudio, generateInfographic } from '@/lib/content/media'
import { deepResearch } from '@/lib/google'
import { generateXThread, generateSubstackArticle } from '@/lib/content/formatters'
import { generateVideoScript } from '@/lib/content/video'
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

export async function saveSignalPublicationAction(signalHash: string, type: any, content: any) {
  await savePublication(signalHash, type, content);
  return true;
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


export async function addSourceAction(name: string, url: string) {
  const { data, error } = await supabase
    .from('sources')
    .insert({ name, url, active: true })
    .select()
    .single();

  if (error) {
    console.error(error);
    return null;
  }
  return data;
}

export async function toggleSourceAction(id: string, active: boolean) {
  await supabase.from('sources').update({ active }).eq('id', id);
}

export async function deleteSourceAction(id: string) {
  await supabase.from('sources').delete().eq('id', id);
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

export async function generateInfographicAction(signalHash: string, headline: string, summary: string) {
  const imageUrl = await generateInfographic(headline, summary);
  if (imageUrl) {
    await savePublication(signalHash, 'infographic', imageUrl);
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


import { storeMemory } from '@/lib/memory/cortex'

export async function analyzeSignalAction(headline: string, content: string) {
  const result = await analyzeSignal(headline, content);

  // 1. Update Signals Table
  await supabase.from('signals')
    .update({
      ai_summary: result.summary,
      ai_script: result.script,
      ai_tags: result.tags
    })
    .eq('headline', headline);

  // 2. Memorize in Cortex (Vector DB)
  const { data: signal } = await supabase.from('signals').select('id').eq('headline', headline).single();

  if (signal) {
    await storeMemory(
      `HEADLINE: ${headline}\nSUMMARY: ${result.summary}\nTAGS: ${result.tags.join(', ')}`,
      { type: 'signal_analysis', tags: result.tags },
      signal.id
    );
  }

  return result;
}

export async function analyzeSignalDeepAction(signalHash: string, content: string) {
  const deepDive = await deepResearch(content);
  if (deepDive) {
    // We can store this as a specialized 'deep_dive' publication or just update the signal
    // For now, let's store it as a 'article' type but maybe prefix it, or just use a new 'deep_dive' type?
    // Let's reuse 'article' for now but distinct in UI, or actually 'deep_dive' is better if we update types.
    // Let's stick to saving it as a publication of type 'article' with a special note?
    // Actually, user wants "NotebookLM" style, which is often a report.
    // Let's store it as 'article' for now to keep it simple, or update types.
    // Let's update types to include 'deep_dive' later. For now, return it.
    await savePublication(signalHash, 'research', deepDive); // Save as specialized research type
  }
  return deepDive;
}

// ... existing imports
import { generateDailyBriefing } from '@/lib/agents/watchman'

// ... existing imports
import { scoreSignal } from '@/lib/agents/triage'

// ... existing actions

export async function runTriageAction(signalId: string, currentSignal: Signal) {
  // 1. Score the signal
  const triage = await scoreSignal(currentSignal);

  // 2. Auto-act based on recommendation
  let newStatus = currentSignal.status;
  if (triage.recommended_action === 'approve') newStatus = 'processing'; // Editor Desk
  if (triage.recommended_action === 'archive') newStatus = 'archived'; // Bin

  // 3. Update DB
  if (triage.recommended_action !== 'review') {
    const { error } = await supabase
      .from('signals')
      .update({ status: newStatus })
      .eq('id', signalId);

    if (error) console.error("Auto-Triage Update Failed:", error);
  }

  // 4. Return result for UI feedback
  return triage;
}

export async function generateDailyBriefingAction() {
  const briefing = await generateDailyBriefing();
  return briefing;
}

export async function generateVideoScriptAction(signalHash: string, headline: string, summary: string) {
  const script = await generateVideoScript(headline, summary);
  if (script) {
    await savePublication(signalHash, 'video_script', script);
  }
  return script;
}
