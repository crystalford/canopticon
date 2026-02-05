import { db, signals, articles, logs, sources, rawArticles } from '@/db'
import { eq, desc, lte, and } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { processArticle, runSignalAnalysis } from '@/lib/signals/pipeline'
import { synthesizeArticle, publishArticle } from '@/lib/synthesis'
import { postToBluesky, postToMastodon } from '@/lib/distribution'
import { autoApprovePendingSignals, autoPublishDraftArticles } from '@/lib/orchestration/decisions'
import { recordJobExecution } from '@/lib/orchestration/scheduler'

/**
 * Automation Workflow Orchestrator
 * 
 * Master automation loop that:
 * 1. Polls sources for new articles
 * 2. Processes articles through signal pipeline
 * 3. Auto-approves signals based on scoring rules
 * 4. Synthesizes articles
 * 5. Auto-publishes articles
 * 6. Distributes to social media
 */

interface AutomationConfig {
  significanceThreshold: number // Min score to auto-approve
  skipSecondaryAnalysis: boolean // Skip Engine B in MVP
  enableAutoPublish: boolean // Publish immediately after synthesis
  enableSocialDistribution: boolean // Post to social media
  batchSize: number // Process this many articles per run
}

const DEFAULT_CONFIG: AutomationConfig = {
  significanceThreshold: 65, // Signals scoring 65+ auto-approve
  skipSecondaryAnalysis: true, // Engine B deferred to Phase 2
  enableAutoPublish: true, // Publish immediately in MVP
  enableSocialDistribution: true, // Distribute to social media
  batchSize: 10, // Process up to 10 articles per cycle
}

interface WorkflowStats {
  cycleId: string
  timestamp: Date
  articlesIngested: number
  signalsProcessed: number
  signalsApproved: number
  articlesSynthesized: number
  articlesPublished: number
  socialPostsCreated: number
  errors: string[]
}

/**
 * MAIN AUTOMATION LOOP
 * Run this on a schedule (e.g., every 5 minutes via background job)
 */
export async function runAutomationCycle(config: Partial<AutomationConfig> = {}): Promise<WorkflowStats> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }
  const cycleId = uuidv4()
  const stats: WorkflowStats = {
    cycleId,
    timestamp: new Date(),
    articlesIngested: 0,
    signalsProcessed: 0,
    signalsApproved: 0,
    articlesSynthesized: 0,
    articlesPublished: 0,
    socialPostsCreated: 0,
    errors: [],
  }

  await logWorkflow(cycleId, 'info', 'Automation cycle started', {})

  try {
    // PHASE 1: Process unprocessed articles
    const startTime = Date.now()
    const unprocessedCount = await processUnprocessedArticles(cycleId, finalConfig, stats)
    stats.articlesIngested = unprocessedCount
    await recordJobExecution('ingestion', 'success', Date.now() - startTime, {
      articlesProcessed: unprocessedCount,
    })

    // PHASE 2: Auto-approve pending signals based on rules
    const decisionStart = Date.now()
    const decisionResult = await autoApprovePendingSignals()
    stats.signalsApproved = decisionResult.approved
    stats.signalsProcessed = decisionResult.approved + decisionResult.flagged
    if (decisionResult.errors.length > 0) {
      stats.errors.push(...decisionResult.errors)
    }
    await recordJobExecution(
      'signal-processing',
      decisionResult.errors.length === 0 ? 'success' : 'failure',
      Date.now() - decisionStart,
      {
        signalsApproved: decisionResult.approved,
        signalsFlagged: decisionResult.flagged,
        errors: decisionResult.errors.length,
      }
    )

    // PHASE 3: Synthesize approved signals
    const synthesisStart = Date.now()
    const synthesizedCount = await synthesizeApprovedSignals(cycleId, finalConfig, stats)
    stats.articlesSynthesized = synthesizedCount
    await recordJobExecution('synthesis', 'success', Date.now() - synthesisStart, {
      articlesSynthesized: synthesizedCount,
    })

    // PHASE 4: Auto-publish draft articles based on rules
    if (finalConfig.enableAutoPublish) {
      const publishStart = Date.now()
      const publishResult = await autoPublishDraftArticles()
      stats.articlesPublished = publishResult.published
      if (publishResult.errors.length > 0) {
        stats.errors.push(...publishResult.errors)
      }
      await recordJobExecution(
        'publishing',
        publishResult.errors.length === 0 ? 'success' : 'failure',
        Date.now() - publishStart,
        {
          articlesPublished: publishResult.published,
          errors: publishResult.errors.length,
        }
      )
    }

    // PHASE 5: Distribute to social media
    if (finalConfig.enableSocialDistribution) {
      const socialCount = await distributeToSocial(cycleId, finalConfig, stats)
      stats.socialPostsCreated = socialCount
    }

    await logWorkflow(cycleId, 'info', 'Automation cycle completed', {
      articlesIngested: stats.articlesIngested,
      signalsApproved: stats.signalsApproved,
      articlesSynthesized: stats.articlesSynthesized,
      articlesPublished: stats.articlesPublished,
      socialPostsCreated: stats.socialPostsCreated,
      errors: stats.errors,
    })

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    stats.errors.push(message)
    await logWorkflow(cycleId, 'error', `Automation cycle failed: ${message}`, {})
  }

  return stats
}

/**
 * PHASE 1: Process unprocessed articles (includes AI scoring)
 */
async function processUnprocessedArticles(
  cycleId: string,
  config: AutomationConfig,
  stats: WorkflowStats
): Promise<number> {
  try {
    const unprocessed = await db
      .select({ id: rawArticles.id })
      .from(rawArticles)
      .where(eq(rawArticles.isProcessed, false))
      .orderBy(rawArticles.createdAt)
      .limit(config.batchSize)

    console.log(`[v0] Phase 1: Processing ${unprocessed.length} unprocessed articles`)

    let processed = 0

    for (const article of unprocessed) {
      try {
        console.log(`[v0] Phase 1: Processing article ${article.id}...`)
        
        // Create initial signal via pipeline
        const pipelineResult = await processArticle(article.id)
        console.log(`[v0] Pipeline result:`, pipelineResult)
        
        if (pipelineResult.success && pipelineResult.signalId) {
          processed++
          stats.signalsProcessed++

          console.log(`[v0] ✓ Created signal ${pipelineResult.signalId} for article ${article.id}`)
          console.log(`[v0] Running AI analysis for signal ${pipelineResult.signalId}...`)

          // NOW run AI analysis to score the signal
          const analysisResult = await runSignalAnalysis(pipelineResult.signalId)
          console.log(`[v0] Analysis result:`, analysisResult)
          
          if (analysisResult.success) {
            console.log(`[v0] ✓ Analysis complete for signal ${pipelineResult.signalId}`)
          } else {
            const message = analysisResult.reason || 'Analysis failed'
            console.error(`[v0] ✗ Analysis failed for signal ${pipelineResult.signalId}: ${message}`)
            stats.errors.push(`Failed to analyze signal ${pipelineResult.signalId}: ${message}`)
          }
        } else {
          console.error(`[v0] ✗ Pipeline failed for article ${article.id}: ${pipelineResult.reason}`)
          stats.errors.push(`Pipeline failed for article ${article.id}: ${pipelineResult.reason}`)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        console.error(`[v0] ✗ Exception processing article ${article.id}:`, message)
        console.error(error)
        stats.errors.push(`Failed to process article ${article.id}: ${message}`)
      }
    }

    await logWorkflow(cycleId, 'info', `Processed ${processed} unprocessed articles`, { processed })
    console.log(`[v0] Phase 1 complete: ${processed} articles processed`)
    return processed

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[v0] Phase 1 failed:`, error)
    await logWorkflow(cycleId, 'error', `Phase 1 failed: ${message}`, {})
    throw error
  }
}

/**
 * PHASE 3: Synthesize approved signals into articles
 */
async function synthesizeApprovedSignals(
  cycleId: string,
  config: AutomationConfig,
  stats: WorkflowStats
): Promise<number> {
  try {
    // Find approved signals without articles
    const approvedSignals = await db
      .select({ id: signals.id })
      .from(signals)
      .where(eq(signals.status, 'approved'))
      .orderBy(signals.createdAt)
      .limit(config.batchSize)

    console.log(`[v0] Phase 3: Found ${approvedSignals.length} approved signals to synthesize`)

    let synthesized = 0

    for (const signal of approvedSignals) {
      try {
        console.log(`[v0] Synthesizing article for signal ${signal.id}...`)
        const result = await synthesizeArticle(signal.id)
        if (result.success) {
          synthesized++
          await logWorkflow(cycleId, 'info', 'Article synthesized', {
            signalId: signal.id,
            articleId: result.articleId,
          })
          console.log(`[v0] Article synthesized: ${result.articleId}`)
        } else {
          const err = result.error || 'Unknown error'
          console.error(`[v0] Synthesis failed for signal ${signal.id}: ${err}`)
          stats.errors.push(`Failed to synthesize signal ${signal.id}: ${err}`)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        console.error(`[v0] Synthesis error for signal ${signal.id}:`, error)
        stats.errors.push(`Synthesis error for signal ${signal.id}: ${message}`)
      }
    }

    console.log(`[v0] Phase 3 complete: ${synthesized} articles synthesized`)
    return synthesized

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[v0] Phase 3 failed:`, error)
    await logWorkflow(cycleId, 'error', `Phase 3 failed: ${message}`, {})
    throw error
  }
}

/**
 * PHASE 5: Distribute published articles to social media
 */
async function distributeToSocial(
  cycleId: string,
  config: AutomationConfig,
  stats: WorkflowStats
): Promise<number> {
  // TODO: Implement social distribution
  // This will call postToBluesky and postToMastodon for recently published articles
  // For now, return 0 - we'll wire this up in the distribution task
  return 0
}

/**
 * Workflow logging
 */
async function logWorkflow(
  cycleId: string,
  level: string,
  message: string,
  metadata: Record<string, unknown>
): Promise<void> {
  try {
    await db.insert(logs).values({
      component: 'orchestrator',
      runId: cycleId,
      level,
      message,
      metadata,
    })
  } catch (error) {
    console.error('[ORCHESTRATOR] Failed to log:', error)
  }
}

export type { WorkflowStats, AutomationConfig }
