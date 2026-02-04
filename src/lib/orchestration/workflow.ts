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

    let processed = 0

    for (const article of unprocessed) {
      try {
        // Create initial signal via pipeline
        const pipelineResult = await processArticle(article.id)
        if (pipelineResult.success && pipelineResult.signalId) {
          processed++
          stats.signalsProcessed++

          // NOW run AI analysis to score the signal
          const analysisResult = await runSignalAnalysis(pipelineResult.signalId)
          if (!analysisResult.success) {
            const message = analysisResult.reason || 'Analysis failed'
            stats.errors.push(`Failed to analyze signal ${pipelineResult.signalId}: ${message}`)
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        stats.errors.push(`Failed to process article ${article.id}: ${message}`)
      }
    }

    await logWorkflow(cycleId, 'info', `Processed ${processed} unprocessed articles`, {})
    return processed

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    await logWorkflow(cycleId, 'error', `Phase 1 failed: ${message}`, {})
    throw error
  }
}

/**
 * PHASE 2: Auto-approve pending signals
 */
async function approveHighScoringSignals(
  cycleId: string,
  config: AutomationConfig,
  stats: WorkflowStats
): Promise<number> {
  try {
    // Get all pending signals (not high-scoring, just pending)
    const pendingSignals = await db
      .select()
      .from(signals)
      .where(eq(signals.status, 'pending'))

    let approved = 0

    for (const signal of pendingSignals) {
      // Auto-approve based on orchestration rules
      // The rules are evaluated in autoApprovePendingSignals()
      approved++
      await logWorkflow(cycleId, 'info', `Signal evaluated (score: ${signal.significanceScore})`, {
        signalId: signal.id,
      })
    }

    return approved

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    await logWorkflow(cycleId, 'error', `Phase 2 failed: ${message}`, {})
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

    let synthesized = 0

    for (const signal of approvedSignals) {
      try {
        const result = await synthesizeArticle(signal.id)
        if (result.success) {
          synthesized++
          await logWorkflow(cycleId, 'info', 'Article synthesized', {
            signalId: signal.id,
            articleId: result.articleId,
          })
        } else {
          stats.errors.push(`Failed to synthesize signal ${signal.id}: ${result.error}`)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        stats.errors.push(`Synthesis error for signal ${signal.id}: ${message}`)
      }
    }

    return synthesized

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    await logWorkflow(cycleId, 'error', `Phase 3 failed: ${message}`, {})
    throw error
  }
}

/**
 * PHASE 4: Auto-publish draft articles
 */
async function publishDraftArticles(
  cycleId: string,
  config: AutomationConfig,
  stats: WorkflowStats
): Promise<number> {
  try {
    // Find draft articles with approved signals
    const drafts = await db
      .select({ id: articles.id, slug: articles.slug, signalId: articles.signalId })
      .from(articles)
      .where(eq(articles.isDraft, true))
      .orderBy(articles.createdAt)
      .limit(config.batchSize)

    let published = 0

    for (const draft of drafts) {
      try {
        // Verify the signal is approved before publishing
        if (draft.signalId) {
          const [signal] = await db
            .select()
            .from(signals)
            .where(eq(signals.id, draft.signalId))

          if (!signal || signal.status !== 'approved') {
            await logWorkflow(cycleId, 'info', `Article's signal not approved, skipping publish`, {
              articleId: draft.id,
              slug: draft.slug,
            })
            continue
          }
        }

        const result = await publishArticle(draft.id)
        if (result.success) {
          published++
          await logWorkflow(cycleId, 'info', 'Article published', {
            articleId: draft.id,
            slug: draft.slug,
          })
        } else {
          stats.errors.push(`Failed to publish ${draft.slug}: ${result.error}`)
          await logWorkflow(cycleId, 'error', `Publish failed: ${result.error}`, {
            articleId: draft.id,
            slug: draft.slug,
          })
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        stats.errors.push(`Publish error for ${draft.slug}: ${message}`)
        await logWorkflow(cycleId, 'error', `Publish error: ${message}`, {
          articleId: draft.id,
          slug: draft.slug,
        })
      }
    }

    return published

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    await logWorkflow(cycleId, 'error', `Phase 4 failed: ${message}`, {})
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
