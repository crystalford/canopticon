import { db } from '@/db'
import {
  signals,
  articles,
  signalStatusEnum,
  clusters,
  rawArticles,
} from '@/db/schema'
import { eq, and, gte, lte } from 'drizzle-orm'

export interface ApprovalRule {
  name: string
  enabled: boolean
  conditions: {
    minConfidenceScore?: number
    minSignificanceScore?: number
    signalTypes?: string[]
    maxAgeMins?: number
  }
}

export interface PublishingRule {
  name: string
  enabled: boolean
  conditions: {
    minArticleAge?: number // minutes to wait before auto-publishing
    requireApprovedSignal?: boolean
    autoDeriveContent?: boolean // auto-generate threads, emails, etc.
  }
}

const DEFAULT_APPROVAL_RULES: ApprovalRule[] = [
  {
    name: 'high-confidence-breaking',
    enabled: true,
    conditions: {
      minConfidenceScore: 75,
      minSignificanceScore: 60,
      signalTypes: ['breaking'],
      maxAgeMins: 120, // Only approve recent signals
    },
  },
  {
    name: 'high-significance-shift',
    enabled: true,
    conditions: {
      minConfidenceScore: 70,
      minSignificanceScore: 80,
      signalTypes: ['shift'],
      maxAgeMins: 180,
    },
  },
  {
    name: 'contradiction-alerts',
    enabled: true,
    conditions: {
      minConfidenceScore: 65,
      minSignificanceScore: 70,
      signalTypes: ['contradiction'],
      maxAgeMins: 240,
    },
  },
  {
    name: 'analyzed-moderate-signals',
    enabled: true,
    conditions: {
      minConfidenceScore: 50,  // Lower threshold for analyzed signals
      minSignificanceScore: 50,
      maxAgeMins: 180,
    },
  },
]

const DEFAULT_PUBLISHING_RULES: PublishingRule[] = [
  {
    name: 'auto-publish-approved-signals',
    enabled: true,
    conditions: {
      minArticleAge: 0, // Publish immediately after synthesis (removed 5 min delay)
      requireApprovedSignal: true,
      autoDeriveContent: true,
    },
  },
]

/**
 * Auto-approve pending signals based on configured rules
 */
export async function autoApprovePendingSignals(): Promise<{
  approved: number
  flagged: number
  errors: string[]
}> {
  const errors: string[] = []
  let approved = 0
  let flagged = 0

  try {
    // Get all pending signals
    const pendingSignals = await db
      .select()
      .from(signals)
      .where(eq(signals.status, 'pending'))

    console.log(`[v0] Found ${pendingSignals.length} pending signals to evaluate`)

    for (const signal of pendingSignals) {
      try {
        // Check each approval rule
        let shouldApprove = false

        for (const rule of DEFAULT_APPROVAL_RULES) {
          if (!rule.enabled) continue

          const matches = checkApprovalRuleMatch(signal, rule)
          if (matches) {
            console.log(
              `[v0] Signal ${signal.id} matched rule '${rule.name}', approving...`
            )
            shouldApprove = true
            break
          }
        }

        if (shouldApprove) {
          await db
            .update(signals)
            .set({
              status: 'approved',
              updatedAt: new Date(),
            })
            .where(eq(signals.id, signal.id))

          approved++
          console.log(`[v0] ✓ Approved signal ${signal.id} (confidence: ${signal.confidenceScore}, significance: ${signal.significanceScore})`)
        } else {
          // No rule matched - log why
          console.log(
            `[v0] Signal ${signal.id} did not match rules (conf: ${signal.confidenceScore}, sig: ${signal.significanceScore}, type: ${signal.signalType}) - staying pending`
          )
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        errors.push(`Signal ${signal.id}: ${errorMsg}`)
        console.error(`[v0] Error processing signal ${signal.id}:`, error)
      }
    }

    console.log(
      `[v0] Signal approval cycle complete: ${approved} approved, ${flagged} flagged`
    )

    return { approved, flagged, errors }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    errors.push(`Fatal error in autoApprovePendingSignals: ${errorMsg}`)
    console.error('[v0] Fatal error in signal approval:', error)
    return { approved, flagged, errors }
  }
}

/**
 * Check if a signal matches an approval rule
 */
function checkApprovalRuleMatch(signal: any, rule: ApprovalRule): boolean {
  const { conditions } = rule

  // Check confidence score
  if (conditions.minConfidenceScore !== undefined) {
    if (signal.confidenceScore < conditions.minConfidenceScore) {
      return false
    }
  }

  // Check significance score
  if (conditions.minSignificanceScore !== undefined) {
    if (signal.significanceScore < conditions.minSignificanceScore) {
      return false
    }
  }

  // Check signal type
  if (conditions.signalTypes && conditions.signalTypes.length > 0) {
    if (!conditions.signalTypes.includes(signal.signalType)) {
      return false
    }
  }

  // Check age - signal must be recent
  if (conditions.maxAgeMins !== undefined) {
    const signalAge = Date.now() - signal.createdAt.getTime()
    const maxAgeMs = conditions.maxAgeMins * 60 * 1000
    if (signalAge > maxAgeMs) {
      console.log(
        `[v0] Signal too old: ${signalAge}ms > ${maxAgeMs}ms`
      )
      return false
    }
  }

  return true
}

/**
 * Auto-publish synthesized articles based on configured rules
 */
export async function autoPublishDraftArticles(): Promise<{
  published: number
  errors: string[]
}> {
  const errors: string[] = []
  let published = 0

  try {
    // Get draft articles with approved signals
    const draftArticles = await db
      .select()
      .from(articles)
      .where(
        and(
          eq(articles.isDraft, true),
          // Only publish if there's an approved signal
          // We'll check this in the loop
        )
      )

    console.log(`[v0] Found ${draftArticles.length} draft articles to evaluate`)

    for (const article of draftArticles) {
      try {
        // Check publishing rules
        let shouldPublish = false

        for (const rule of DEFAULT_PUBLISHING_RULES) {
          if (!rule.enabled) continue

          const matches = await checkPublishingRuleMatch(article, rule)
          if (matches) {
            console.log(
              `[v0] Article ${article.id} matched rule '${rule.name}', publishing...`
            )
            shouldPublish = true
            break
          }
        }

        if (shouldPublish) {
          await db
            .update(articles)
            .set({
              isDraft: false,
              publishedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(articles.id, article.id))

          published++
          console.log(`[v0] Published article ${article.id}`)

          // TODO: Trigger derivative content generation here
          // e.g., social posts, email threads, etc.
        } else {
          console.log(
            `[v0] Article ${article.id} did not match any publishing rules, staying draft`
          )
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        errors.push(`Article ${article.id}: ${errorMsg}`)
        console.error(`[v0] Error processing article ${article.id}:`, error)
      }
    }

    console.log(`[v0] Article publishing cycle complete: ${published} published`)

    return { published, errors }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    errors.push(`Fatal error in autoPublishDraftArticles: ${errorMsg}`)
    console.error('[v0] Fatal error in article publishing:', error)
    return { published, errors }
  }
}

/**
 * Check if an article matches a publishing rule
 */
async function checkPublishingRuleMatch(
  article: any,
  rule: PublishingRule
): Promise<boolean> {
  const { conditions } = rule

  // Check minimum age before publishing
  if (conditions.minArticleAge !== undefined) {
    const articleAge = Date.now() - article.createdAt.getTime()
    const minAgeMs = conditions.minArticleAge * 60 * 1000
    if (articleAge < minAgeMs) {
      console.log(
        `[v0] Article too fresh: ${articleAge}ms < ${minAgeMs}ms`
      )
      return false
    }
  }

  // Check if article requires an approved signal
  if (conditions.requireApprovedSignal && article.signalId) {
    const signal = await db
      .select()
      .from(signals)
      .where(eq(signals.id, article.signalId))

    if (!signal || signal.length === 0 || signal[0].status !== 'approved') {
      console.log(`[v0] Article's signal not approved`)
      return false
    }
  }

  return true
}

/**
 * Get current decision engine configuration
 */
export function getApprovalRules(): ApprovalRule[] {
  return DEFAULT_APPROVAL_RULES
}

export function getPublishingRules(): PublishingRule[] {
  return DEFAULT_PUBLISHING_RULES
}

/**
 * Update approval rules (for future configurability)
 */
export function updateApprovalRules(rules: ApprovalRule[]): void {
  // TODO: Persist to Redis or database
  console.log('[v0] Approval rules updated:', rules)
}

/**
 * Update publishing rules (for future configurability)
 */
export function updatePublishingRules(rules: PublishingRule[]): void {
  // TODO: Persist to Redis or database
  console.log('[v0] Publishing rules updated:', rules)
}
