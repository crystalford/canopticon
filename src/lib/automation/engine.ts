/**
 * CLEAN AUTOMATION ENGINE
 * A simple, visible, working system that processes articles end-to-end
 */

import { db } from '@/db'
import { rawArticles, clusters, signals, articles, logs } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'

// ============================================================================
// LOGGING - So you can see what's happening
// ============================================================================

async function log(phase: string, message: string, data?: any) {
  console.log(`[AUTOMATION ${phase}] ${message}`, data || '')
  
  await db.insert(logs).values({
    workflowId: 'automation',
    level: 'info',
    message: `[${phase}] ${message}`,
    metadata: data || {}
  })
}

async function logError(phase: string, message: string, error: any) {
  console.error(`[AUTOMATION ${phase}] ERROR: ${message}`, error)
  
  await db.insert(logs).values({
    workflowId: 'automation',
    level: 'error',
    message: `[${phase}] ${message}`,
    metadata: { error: error.message || String(error) }
  })
}

// ============================================================================
// PHASE 1: Process Raw Articles into Signals
// ============================================================================

export async function processRawArticles(limit: number = 5) {
  await log('PHASE1', 'Starting: Process raw articles into signals')
  
  try {
    // Find unprocessed articles
    const unprocessed = await db
      .select()
      .from(rawArticles)
      .where(eq(rawArticles.isProcessed, false))
      .limit(limit)
    
    await log('PHASE1', `Found ${unprocessed.length} unprocessed articles`)
    
    let processed = 0
    
    for (const article of unprocessed) {
      try {
        await log('PHASE1', `Processing article: ${article.title?.substring(0, 50)}...`)
        
        // Create a cluster for this article
        const [cluster] = await db.insert(clusters).values({
          articleIds: [article.id],
          topicKeywords: []
        }).returning()
        
        await log('PHASE1', `Created cluster ${cluster.id}`)
        
        // Create a signal for this cluster
        const [signal] = await db.insert(signals).values({
          clusterId: cluster.id,
          signalType: 'shift',
          confidenceScore: 0,
          significanceScore: 0,
          status: 'pending',
          aiNotes: ''
        }).returning()
        
        await log('PHASE1', `Created signal ${signal.id}`)
        
        // Mark article as processed
        await db
          .update(rawArticles)
          .set({ isProcessed: true })
          .where(eq(rawArticles.id, article.id))
        
        processed++
        
      } catch (error) {
        await logError('PHASE1', `Failed to process article ${article.id}`, error)
      }
    }
    
    await log('PHASE1', `Complete: Processed ${processed} articles`)
    return { success: true, processed }
    
  } catch (error) {
    await logError('PHASE1', 'Phase failed', error)
    return { success: false, error: String(error) }
  }
}

// ============================================================================
// PHASE 2: Analyze Signals with AI
// ============================================================================

export async function analyzeSignals(limit: number = 5) {
  await log('PHASE2', 'Starting: Analyze pending signals with AI')
  
  try {
    // Find pending signals
    const pendingSignals = await db
      .select({
        signal: signals,
        cluster: clusters
      })
      .from(signals)
      .innerJoin(clusters, eq(signals.clusterId, clusters.id))
      .where(and(
        eq(signals.status, 'pending'),
        eq(signals.confidenceScore, 0)
      ))
      .limit(limit)
    
    await log('PHASE2', `Found ${pendingSignals.length} pending signals`)
    
    let analyzed = 0
    
    for (const { signal, cluster } of pendingSignals) {
      try {
        // Get the articles for this cluster
        const clusterArticles = await db
          .select()
          .from(rawArticles)
          .where(eq(rawArticles.id, cluster.articleIds[0]))
        
        if (clusterArticles.length === 0) {
          await log('PHASE2', `No articles found for cluster ${cluster.id}`)
          continue
        }
        
        const article = clusterArticles[0]
        await log('PHASE2', `Analyzing signal ${signal.id} for article: ${article.title?.substring(0, 50)}...`)
        
        // Call AI to analyze the article
        const result = await generateObject({
          model: openai('gpt-4o-mini'),
          schema: z.object({
            signalType: z.enum(['breaking', 'shift', 'contradiction', 'repetition']),
            confidence: z.number().min(0).max(100),
            significance: z.number().min(0).max(100),
            notes: z.string()
          }),
          prompt: `Analyze this article and determine:
1. Signal type (breaking = major new development, shift = market change, contradiction = conflicts with prior info, repetition = confirms existing narrative)
2. Confidence (0-100): How confident are you this is newsworthy?
3. Significance (0-100): How important is this to market participants?
4. Notes: Brief explanation

Article Title: ${article.title}
Article Content: ${article.content?.substring(0, 2000)}`
        })
        
        await log('PHASE2', `AI analysis complete`, result.object)
        
        // Update signal with AI analysis
        await db
          .update(signals)
          .set({
            signalType: result.object.signalType,
            confidenceScore: Math.round(result.object.confidence),
            significanceScore: Math.round(result.object.significance),
            aiNotes: result.object.notes,
            status: 'flagged' // Move to flagged for approval
          })
          .where(eq(signals.id, signal.id))
        
        analyzed++
        
      } catch (error) {
        await logError('PHASE2', `Failed to analyze signal ${signal.id}`, error)
      }
    }
    
    await log('PHASE2', `Complete: Analyzed ${analyzed} signals`)
    return { success: true, analyzed }
    
  } catch (error) {
    await logError('PHASE2', 'Phase failed', error)
    return { success: false, error: String(error) }
  }
}

// ============================================================================
// PHASE 3: Auto-approve high-quality signals
// ============================================================================

export async function approveSignals(minConfidence: number = 60, minSignificance: number = 60) {
  await log('PHASE3', 'Starting: Auto-approve high-quality signals')
  
  try {
    // Find flagged signals that meet threshold
    const flagged = await db
      .select()
      .from(signals)
      .where(eq(signals.status, 'flagged'))
    
    await log('PHASE3', `Found ${flagged.length} flagged signals`)
    
    let approved = 0
    
    for (const signal of flagged) {
      if (signal.confidenceScore >= minConfidence && signal.significanceScore >= minSignificance) {
        await db
          .update(signals)
          .set({ status: 'approved' })
          .where(eq(signals.id, signal.id))
        
        await log('PHASE3', `Approved signal ${signal.id} (conf: ${signal.confidenceScore}, sig: ${signal.significanceScore})`)
        approved++
      } else {
        await log('PHASE3', `Signal ${signal.id} below threshold (conf: ${signal.confidenceScore}, sig: ${signal.significanceScore})`)
      }
    }
    
    await log('PHASE3', `Complete: Approved ${approved} signals`)
    return { success: true, approved }
    
  } catch (error) {
    await logError('PHASE3', 'Phase failed', error)
    return { success: false, error: String(error) }
  }
}

// ============================================================================
// PHASE 4: Generate quality articles from approved signals
// ============================================================================

export async function generateArticles(limit: number = 3) {
  await log('PHASE4', 'Starting: Generate articles from approved signals')
  
  try {
    // Find approved signals without articles
    const approved = await db
      .select({
        signal: signals,
        cluster: clusters
      })
      .from(signals)
      .innerJoin(clusters, eq(signals.clusterId, clusters.id))
      .where(eq(signals.status, 'approved'))
      .limit(limit)
    
    await log('PHASE4', `Found ${approved.length} approved signals`)
    
    let generated = 0
    
    for (const { signal, cluster } of approved) {
      try {
        // Check if article already exists
        const existing = await db
          .select()
          .from(articles)
          .where(eq(articles.signalId, signal.id))
        
        if (existing.length > 0) {
          await log('PHASE4', `Article already exists for signal ${signal.id}`)
          continue
        }
        
        // Get source articles
        const sourceArticles = await db
          .select()
          .from(rawArticles)
          .where(eq(rawArticles.id, cluster.articleIds[0]))
        
        if (sourceArticles.length === 0) continue
        
        const source = sourceArticles[0]
        await log('PHASE4', `Generating article for signal ${signal.id}`)
        
        // Generate high-quality article with AI
        const result = await generateObject({
          model: openai('gpt-4o'),
          schema: z.object({
            title: z.string(),
            summary: z.string(),
            content: z.string()
          }),
          prompt: `Write a comprehensive, in-depth market analysis article (1000-1500 words) based on this source.

Signal Type: ${signal.signalType}
Confidence: ${signal.confidenceScore}
Significance: ${signal.significanceScore}
AI Notes: ${signal.aiNotes}

Source Article:
Title: ${source.title}
Content: ${source.content}

Requirements:
- Professional, analytical tone
- In-depth analysis with context
- Clear implications for market participants
- Well-structured with multiple sections
- 1000-1500 words minimum
- Include relevant data and insights`
        })
        
        await log('PHASE4', `Article generated: ${result.object.title}`)
        
        // Create slug
        const slug = result.object.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
        
        // Save article
        await db.insert(articles).values({
          signalId: signal.id,
          slug,
          title: result.object.title,
          summary: result.object.summary,
          content: result.object.content,
          isDraft: false,
          publishedAt: new Date()
        })
        
        await log('PHASE4', `Article published: ${slug}`)
        generated++
        
      } catch (error) {
        await logError('PHASE4', `Failed to generate article for signal ${signal.id}`, error)
      }
    }
    
    await log('PHASE4', `Complete: Generated ${generated} articles`)
    return { success: true, generated }
    
  } catch (error) {
    await logError('PHASE4', 'Phase failed', error)
    return { success: false, error: String(error) }
  }
}

// ============================================================================
// MAIN: Run full automation cycle
// ============================================================================

export async function runAutomationCycle() {
  await log('MAIN', '========================================')
  await log('MAIN', 'Starting automation cycle')
  await log('MAIN', '========================================')
  
  const stats = {
    articlesProcessed: 0,
    signalsAnalyzed: 0,
    signalsApproved: 0,
    articlesGenerated: 0,
    errors: [] as string[]
  }
  
  try {
    // Phase 1: Process raw articles
    const phase1 = await processRawArticles(5)
    if (phase1.success) stats.articlesProcessed = phase1.processed || 0
    
    // Phase 2: Analyze signals
    const phase2 = await analyzeSignals(5)
    if (phase2.success) stats.signalsAnalyzed = phase2.analyzed || 0
    
    // Phase 3: Approve signals
    const phase3 = await approveSignals(60, 60)
    if (phase3.success) stats.signalsApproved = phase3.approved || 0
    
    // Phase 4: Generate articles
    const phase4 = await generateArticles(3)
    if (phase4.success) stats.articlesGenerated = phase4.generated || 0
    
    await log('MAIN', '========================================')
    await log('MAIN', 'Automation cycle complete', stats)
    await log('MAIN', '========================================')
    
    return { success: true, stats }
    
  } catch (error) {
    await logError('MAIN', 'Automation cycle failed', error)
    return { success: false, error: String(error), stats }
  }
}
