"use server"

import { analyzeSignal } from '@/lib/analysis/ai'
import { generateThumbnail, generateAudio, generateInfographic } from '@/lib/content/media'
import { deepResearch } from '@/lib/google'
import { generateXThread, generateSubstackArticle } from '@/lib/content/formatters'
import { generateVideoScript } from '@/lib/content/video'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isUserAdmin } from '@/lib/auth'
import { Signal } from '@/types'

// ... existing media actions ...

import { savePublication, getPublications } from '@/lib/content/persistence'

import { revalidatePath } from 'next/cache'
import { triggerUplink } from '@/lib/publishing/webhook'
import { getGlobalSignals } from '@/lib/ingestion'

export async function runIngestAction() {
  try {
    const result = await getGlobalSignals();
    const { count } = await supabaseAdmin.from('signals').select('*', { count: 'exact', head: true });
    console.log(`[Ingest Action] Fetched ${result.length} signals. DB Count: ${count}`);
    revalidatePath('/admin/dashboard');
    revalidatePath('/');
    return { success: true, count: result.length, dbCount: count };
  } catch (e: any) {
    console.error("[Ingest Action Failed]", e);
    return { success: false, error: e.message || "Unknown Ingest Error" };
  }
}

export async function updateSignalStatusAction(signalId: string, status: 'pending' | 'processing' | 'published' | 'archived') {
  // if (!await isUserAdmin()) throw new Error("Unauthorized");
  try {
    const { data: updatedData, error } = await supabaseAdmin
      .from('signals')
      .update({ status })
      .eq('hash', signalId)
      .select();

    if (updatedData && updatedData.length === 0) {
      return { success: false, error: "Signal not found in DB (Count 0)" };
    }

    if (status === 'published') {
      const { data: signal } = await supabaseAdmin.from('signals').select('*').eq('hash', signalId).single();
      if (signal) {
        triggerUplink(signal).catch(e => console.error(e));
      }
    }

    if (error) {
      console.error("Supabase Error:", error);
      return { success: false, error: "DB Error: " + error.message };
    }

    revalidatePath('/admin/dashboard');
    revalidatePath('/');

    return { success: true };
  } catch (e: any) {
    console.error("Action Exception:", e);
    return { success: false, error: e.message || "Server Exception" };
  }
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
  const { data, error } = await supabaseAdmin
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
  await supabaseAdmin.from('sources').update({ active }).eq('id', id);
}

export async function deleteSourceAction(id: string) {
  await supabaseAdmin.from('sources').delete().eq('id', id);
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
  // if (!isUserAdmin()) throw new Error("Unauthorized");
  const result = await analyzeSignal(headline, content);

  // 1. Update Signals Table
  await supabaseAdmin.from('signals')
    .update({
      ai_summary: result.summary,
      ai_script: result.script,
      ai_tags: result.tags
    })
    .eq('headline', headline);

  // 2. Memorize in Cortex (Vector DB)
  const { data: signal } = await supabaseAdmin.from('signals').select('id').eq('headline', headline).single();

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

// ... existing single triage action
export async function runTriageAction(signalId: string, currentSignal: Signal) {
  // 1. Score the signal
  const triage = await scoreSignal(currentSignal);

  // 2. Auto-act based on recommendation
  let newStatus = currentSignal.status;
  if (triage.recommended_action === 'approve') newStatus = 'approved'; // Changed to intermediate approved
  if (triage.recommended_action === 'archive') newStatus = 'archived'; // Bin

  // 3. Update DB
  if (triage.recommended_action !== 'review') {
    const { error } = await supabaseAdmin
      .from('signals')
      .update({ status: newStatus })
      .eq('hash', signalId);

    if (error) console.error("Auto-Triage Update Failed:", error);
  }

  // 4. Return result for UI feedback
  return triage;
}

export async function runBatchTriageAction() {
  // 1. Fetch pending signals with Source Reliability
  const { data: signals } = await supabaseAdmin
    .from('signals')
    .select('*, sources(reliability_score)')
    .eq('status', 'pending')
    .limit(5);

  if (!signals || signals.length === 0) return { count: 0, message: "No pending signals found." };

  let processed = 0;
  let approved = 0;
  let archived = 0;

  // 2. Loop and Score
  for (const signal of signals) {
    // Extract reliability from join
    // @ts-ignore
    const reliability = signal.sources?.reliability_score;

    // Assume Signal type match
    const triage = await scoreSignal(signal as any, reliability);
    processed++;

    let newStatus = 'pending';
    if (triage.recommended_action === 'approve') { newStatus = 'approved'; approved++; }
    if (triage.recommended_action === 'archive') { newStatus = 'archived'; archived++; }

    // 3. Update DB
    const updatePayload: any = {
      confidence_score: triage.score,
      metadata: { triage_reason: triage.reasoning }
    };
    if (newStatus !== 'pending') updatePayload.status = newStatus;

    await supabaseAdmin
      .from('signals')
      .update(updatePayload)
      .eq('hash', signal.hash);
  }

  return {
    count: processed,
    approved,
    archived,
    message: `Triaged ${processed} signals. Approved ${approved}, Archived ${archived}.`
  };
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

import { generateVideoMaterials } from '@/lib/agents/video-producer'

export async function generateVideoMaterialsAction(signalId: string) {
  const { data: signal } = await supabaseAdmin.from('signals').select('*').eq('id', signalId).single();
  if (!signal) return { success: false, error: "Signal not found" };

  const materials = await generateVideoMaterials(signal as any);
  if (!materials) return { success: false, error: "AI Generation Failed" };

  let articleId;
  const { data: existingArticle } = await supabaseAdmin.from('articles').select('id').eq('signal_id', signalId).single();

  if (existingArticle) {
    articleId = existingArticle.id;
  } else {
    const { data: newArticle, error } = await supabaseAdmin.from('articles').insert({
      signal_id: signalId,
      slug: signal.hash, // Use hash as slug
      headline: signal.headline,
      summary: signal.ai_summary || signal.summary,
      published_at: new Date().toISOString(),
      tier: 'curated',
      video_status: 'script_ready'
    }).select().single();

    if (error) return { success: false, error: "Failed to create article stub: " + error.message };
    articleId = newArticle.id;
  }

  const { error: videoError } = await supabaseAdmin.from('video_materials').upsert({
    article_id: articleId,
    script: materials.script,
    quotes: materials.quotes,
    contradictions: materials.contradictions,
    angles: materials.angles,
    updated_at: new Date().toISOString()
  });

  if (videoError) return { success: false, error: "DB Error: " + videoError.message };

  revalidatePath('/admin/dashboard');
  return { success: true, materials };
}
