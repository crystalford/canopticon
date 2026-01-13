"use server"

import { analyzeSignal, generateSocialPost, generateTrendTake } from '@/lib/analysis/ai'
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
    console.log('[runIngestAction] Starting ingestion...');
    const result = await getGlobalSignals();
    const { count } = await supabaseAdmin.from('signals').select('*', { count: 'exact', head: true });
    console.log(`[Ingest Action] Fetched ${result.length} signals. DB Count: ${count}`);
    revalidatePath('/admin/dashboard');
    revalidatePath('/admin/content');
    revalidatePath('/');
    return {
      success: true,
      count: result.length,
      dbCount: count,
      message: `Found ${result.length} signals from sources. Database has ${count} total signals.`
    };
  } catch (e: any) {
    console.error("[Ingest Action Failed]", e);
    return { success: false, error: e.message || "Unknown Ingest Error", count: 0 };
  }
}

export async function updateSignalStatusAction(signalId: string, status: 'pending' | 'processing' | 'published' | 'deleted' | 'draft') {
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

    if (updatedData) {
      for (const signal of updatedData) {
        // Auto-generate summary for approved/published signals if missing
        if ((status === 'published' || status === 'draft') &&
          (!signal.ai_summary || signal.ai_summary.length < 100)) {
          console.log(`[Auto-Analyze] generating summary for ${signal.headline}`);
          // Await here to ensure archive view sees the summary immediately
          await analyzeSignalAction(signal.headline, signal.raw_content || signal.summary || '');
        }

        if (status === 'published') {
          triggerUplink(signal).catch(e => console.error(e));
        }
      }
    }

    if (error) {
      console.error("Supabase Error:", error);
      return { success: false, error: "DB Error: " + error.message };
    }

    revalidatePath('/admin/dashboard');
    revalidatePath('/admin/review/pending');
    revalidatePath('/archive');
    revalidatePath('/');

    return { success: true };
  } catch (e: any) {
    console.error("Action Exception:", e);
    return { success: false, error: e.message || "Server Exception" };
  }
}

export async function flagSignalAction(signalId: string) {
  try {
    // 1. Update signal status to 'flagged'
    const { data: signal, error } = await supabaseAdmin
      .from('signals')
      .update({ status: 'flagged' })
      .eq('hash', signalId)
      .select()
      .single();

    if (error) {
      console.error("Flag Error:", error);
      return { success: false, error: "DB Error: " + error.message };
    }

    // 2. Auto-generate video materials for flagged signals
    if (signal) {
      // Trigger video materials generation in background
      generateVideoMaterialsAction(signal.id).catch(e => console.error("Video Gen Error:", e));
    }

    revalidatePath('/admin/dashboard');
    revalidatePath('/admin/review/pending');
    return { success: true };
  } catch (e: any) {
    console.error("Flag Exception:", e);
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
  revalidatePath('/admin/sources');
}

export async function updateSourceAction(id: string, updates: {
  max_articles_per_ingest?: number;
  priority?: number;
  active?: boolean;
}) {
  try {
    const { data, error } = await supabaseAdmin
      .from('sources')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/sources');
    return { success: true, source: data };
  } catch (e: any) {
    return { success: false, error: e.message || "Update failed" };
  }
}

export async function deleteSourceAction(id: string) {
  await supabaseAdmin.from('sources').delete().eq('id', id);
  revalidatePath('/admin/sources');
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

  // First, get current metadata to merge fallacies
  const { data: current } = await supabaseAdmin.from('signals').select('metadata').eq('headline', headline).single();
  const newMetadata = {
    ...current?.metadata,
    fallacies: result.fallacies,
    bias: result.bias,
    rhetoric: result.rhetoric
  };

  await supabaseAdmin.from('signals')
    .update({
      ai_summary: result.summary,
      ai_script: result.script,
      ai_tags: result.tags,
      metadata: newMetadata
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

export async function generateSocialPostAction(signalId: string, headline: string, content: string) {
  const post = await generateSocialPost(headline, content);

  if (post && !post.startsWith("Error")) {
    // Fetch current metadata to merge
    const { data: current } = await supabaseAdmin.from('signals').select('metadata').eq('id', signalId).single();
    const newMetadata = { ...current?.metadata, social_post: post };

    await supabaseAdmin.from('signals')
      .update({ metadata: newMetadata })
      .eq('id', signalId);

    // Revalidate studio so UI updates immediately
    revalidatePath('/admin/studio');

    return { success: true, post };
  }

  return { success: false, error: post };
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
  if (triage.recommended_action === 'approve') newStatus = 'draft';
  if (triage.recommended_action === 'archive') newStatus = 'deleted';

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
    if (triage.recommended_action === 'approve') { newStatus = 'draft'; approved++; }
    if (triage.recommended_action === 'archive') { newStatus = 'deleted'; archived++; }

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

import { twitter } from '@/lib/social/twitter'

export async function ingestTrendsAction() {
  try {
    const trends = await twitter.getTrends();

    // Store in DB
    const { error } = await supabaseAdmin.from('trends').insert(trends);

    if (error) {
      console.error("[Trend Ingest DB Error]", error);
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/trends');
    return { success: true, count: trends.length };
  } catch (e: any) {
    console.error("[Trend Ingest Failed]", e);
    return { success: false, error: e.message };
  }
}

export async function getTrendsAction() {
  // Fetch latest trends, sorted by volume
  const { data: trends, error } = await supabaseAdmin
    .from('trends')
    .select('*')
    .order('timestamp', { ascending: false }) // Latest batch
    .limit(20); // Top 20

  if (error) {
    return [];
  }

  // De-dupe by topic if needed, but for now just raw feed
  return trends;
}

export async function generateTrendResponseAction(topic: string, domain: string, sentiment: number) {
  const draft = await generateTrendTake(topic, domain, sentiment);
  if (!draft || draft.startsWith("Error")) {
    return { success: false, error: draft || "Failed to generate" };
  }
  return { success: true, draft };
}

// Article Editor Action
export async function updateArticleAction(signalId: string, updates: {
  headline?: string;
  ai_summary?: string;
  raw_content?: string;
  metadata?: any;
  ai_script?: string;
}) {
  try {
    const { data, error } = await supabaseAdmin
      .from('signals')
      .update(updates)
      .eq('id', signalId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/content');
    revalidatePath(`/admin/content/${signalId}/edit`);
    revalidatePath(`/articles/${data.hash}`);

    return { success: true, signal: data };
  } catch (e: any) {
    return { success: false, error: e.message || "Update failed" };
  }
}

