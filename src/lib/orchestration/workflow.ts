import { db, signals, articles, logs, sources, rawArticles } from '@/db'
import { eq, desc, lte, and } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { processArticle, runSignalAnalysis } from '@/lib/signals/pipeline'
import { synthesizeArticle, publishArticle } from '@/lib/synthesis'
import { postToBluesky, postToMastodon } from '@/lib/distribution'
import { autoApprovePendingSignals, autoPublishDraftArticles } from '@/lib/orchestration/decisions'

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
    const unprocessedCount = await processUnprocessedArticles(cycleId, finalConfig, stats)
    stats.articlesIngested = unprocessedCount

    // PHASE 2: Auto-approve pending signals based on rules
    const decisionResult = await autoApprovePendingSignals()
    stats.signalsApproved = decisionResult.approved
    stats.signalsProcessed = decisionResult.approved + decisionResult.flagged
    if (decisionResult.errors.length > 0) {
      stats.errors.push(...decisionResult.errors)
    }

    // PHASE 3: Synthesize approved signals
    const synthesizedCount = await synthesizeApprovedSignals(cycleId, finalConfig, stats)
    stats.articlesSynthesized = synthesizedCount

    // PHASE 4: Auto-publish draft articles based on rules
    if (finalConfig.enableAutoPublish) {
      const publishResult = await autoPublishDraftArticles()
      stats.articlesPublished = publishResult.published
      if (publishResult.errors.length > 0) {
        stats.errors.push(...publishResult.errors)
      }
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
 * PHASE 1: Process unprocessed raw articles
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
        const result = await processArticle(article.id)
        if (result.success) {
          processed++
          stats.signalsProcessed++
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
 * PHASE 2: Auto-approve high-scoring signals
 */
async function approveHighScoringSignals(
  cycleId: string,
  config: AutomationConfig,
  stats: WorkflowStats
): Promise<number> {
  try {
    // Find flagged signals with high significance scores
    const flaggedSignals = await db
      .select({ id: signals.id, significanceScore: signals.significanceScore })
      .from(signals)
      .where(
        and(
          eq(signals.status, 'flagged'),
          lte(signals.significanceScore, 100)
        )
      )
      .orderBy(desc(signals.significanceScore))
      .limit(config.batchSize)

    let approved = 0

    for (const signal of flaggedSignals) {
      // Auto-approve if score meets threshold
      if (signal.significanceScore >= config.significanceThreshold) {
        await db
          .update(signals)
          .set({ status: 'approved' })
          .where(eq(signals.id, signal.id))

        approved++
        await logWorkflow(cycleId, 'info', `Signal approved (score: ${signal.significanceScore})`, {
          signalId: signal.id,
        })
      } else {
        // Keep in flagged for manual review if below threshold
        await logWorkflow(cycleId, 'info', `Signal flagged for review (score: ${signal.significanceScore})`, {
          signalId: signal.id,
        })
      }
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
    // Find draft articles
    const drafts = await db
      .select({ id: articles.id, slug: articles.slug })
      .from(articles)
      .where(eq(articles.isDraft, true))
      .orderBy(articles.createdAt)
      .limit(config.batchSize)

    let published = 0

    for (const draft of drafts) {
      try {
        const result = await publishArticle(draft.id)
        if (result.success) {
          published++
          await logWorkflow(cycleId, 'info', 'Article published', {
            articleId: draft.id,
            slug: draft.slug,
          })
        } else {
          stats.errors.push(`Failed to publish ${draft.slug}: ${result.error}`)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        stats.errors.push(`Publish error for ${draft.slug}: ${message}`)
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
