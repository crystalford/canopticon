import { db, rawArticles, clusters, clusterArticles, signals, logs } from '@/db'
import { eq, desc, and, gte, sql } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { generateEmbedding, cosineSimilarity, callAI, MODEL_TIERS } from '@/lib/ai'
import {
    SIG_CLASSIFY_V1, SigClassifyInput, SigClassifyOutput,
    SIG_TRIAGE_SCORE_V1, SigTriageInput, SigTriageOutput
} from '@/lib/ai/prompts'
import { checkCostLimits, recordAIUsage, recordSuccess, recordFailure, isCircuitOpen } from '@/lib/ai/cost-control'

/**
 * Signal Pipeline from 04_SIGNAL_PIPELINE
 * 
 * Execution Order (MANDATORY):
 * 1. Raw article enters pipeline
 * 2. Embedding generated (title + first 800 chars)
 * 3. Similarity search against recent clusters
 * 4. Cluster assignment or creation
 * 5. Signal type determination
 * 6. Confidence scoring
 * 7. Significance scoring
 * 8. Triage decision
 * 9. Signal persistence
 */

// Similarity thresholds from 04_SIGNAL_PIPELINE section 5.1
const SIMILARITY_THRESHOLDS = {
    autoMatch: 0.85,
    candidateMatch: 0.70,
} as const

// Triage rules from section 8
const TRIAGE_RULES = {
    autoArchive: 40,
    flagged: 80,
} as const

// Cluster window
const CLUSTER_WINDOW_HOURS = 24
const MAX_ARTICLES_PER_CLUSTER = 10

interface PipelineResult {
    success: boolean
    signalId?: string
    clusterId?: string
    action: 'created' | 'merged' | 'skipped' | 'error'
    reason?: string
}

/**
 * Process an unprocessed raw article through the signal pipeline
 */
export async function processArticle(articleId: string): Promise<PipelineResult> {
    const runId = uuidv4()

    try {
        // Check circuit breaker
        if (isCircuitOpen()) {
            return { success: false, action: 'error', reason: 'Circuit breaker open' }
        }

        // Fetch the article
        const [article] = await db
            .select()
            .from(rawArticles)
            .where(eq(rawArticles.id, articleId))
            .limit(1)

        if (!article) {
            return { success: false, action: 'error', reason: 'Article not found' }
        }

        if (article.isProcessed) {
            return { success: true, action: 'skipped', reason: 'Already processed' }
        }

        await logPipeline(runId, 'info', 'Processing article', { articleId })

        // Step 2: Generate embedding (Optional / Fail-open)
        const textForEmbedding = `${article.title}\n\n${article.bodyText.slice(0, 800)}`

        let embedding: number[] | null = null
        try {
            embedding = await generateEmbedding(textForEmbedding)
        } catch (error) {
            console.error('Embedding failed, proceeding without AI:', error)
        }

        // Step 3: Similarity search (Only if we have an embedding)
        let clusterId: string
        let isNewCluster = false

        if (embedding) {
            const cutoffDate = new Date(Date.now() - CLUSTER_WINDOW_HOURS * 60 * 60 * 1000)
            const matchResult = await findMatchingCluster(embedding, cutoffDate)

            if (matchResult.match && matchResult.similarity >= SIMILARITY_THRESHOLDS.autoMatch) {
                // Auto-match logic...
                clusterId = matchResult.clusterId!
                const clusterSize = await getClusterSize(clusterId)
                if (clusterSize >= MAX_ARTICLES_PER_CLUSTER) {
                    clusterId = await createCluster(articleId)
                    isNewCluster = true
                } else {
                    await addToCluster(clusterId, articleId)
                }
            } else {
                clusterId = await createCluster(articleId)
                isNewCluster = true
            }
        } else {
            // No embedding? Just create a new cluster for this article
            clusterId = await createCluster(articleId)
            isNewCluster = true
            await logPipeline(runId, 'warn', 'Skipped clustering due to missing embedding', { articleId })
        }

        // Mark article as processed
        await db
            .update(rawArticles)
            .set({ isProcessed: true })
            .where(eq(rawArticles.id, articleId))

        // Only create signal for new clusters
        if (!isNewCluster) {
            await logPipeline(runId, 'info', 'Article merged into existing cluster', { clusterId })
            return { success: true, clusterId, action: 'merged' }
        }

        // Step 5-6: Signal type determination and confidence
        const costCheck = await checkCostLimits()
        if (!costCheck.allowed) {
            await logPipeline(runId, 'warn', `Cost limit reached: ${costCheck.reason}`, {})
            return { success: true, clusterId, action: 'created', reason: 'Signal pending - cost limit' }
        }

        const classifyInput: SigClassifyInput = {
            title: article.title,
            body_excerpt: article.bodyText.slice(0, 1000),
        }

        const classifyResult = await callAI<SigClassifyOutput>({
            prompt: SIG_CLASSIFY_V1.prompt,
            input: classifyInput,
            model: 'gpt-4o-mini',
        })

        if (!classifyResult.success || !classifyResult.data) {
            recordFailure()
            // Create signal with defaults
            const signalId = await createSignal(clusterId, 'breaking', 50, 50, 'pending')
            return { success: true, signalId, clusterId, action: 'created', reason: 'Classification failed - using defaults' }
        }
        recordSuccess()

        if (classifyResult.usage) {
            await recordAIUsage({
                model: 'gpt-4o-mini',
                promptName: 'SIG_CLASSIFY_V1',
                inputTokens: classifyResult.usage.inputTokens,
                outputTokens: classifyResult.usage.outputTokens,
                costUsd: classifyResult.usage.costUsd,
            })
        }

        // Step 7: Significance scoring
        const triageInput: SigTriageInput = {
            title: article.title,
            body_excerpt: article.bodyText.slice(0, 1000),
        }

        const triageResult = await callAI<SigTriageOutput>({
            prompt: SIG_TRIAGE_SCORE_V1.prompt,
            input: triageInput,
            model: 'gpt-4o-mini',
        })

        let significanceScore = 50 // default
        if (triageResult.success && triageResult.data) {
            significanceScore = triageResult.data.significance_score
            recordSuccess()

            if (triageResult.usage) {
                await recordAIUsage({
                    model: 'gpt-4o-mini',
                    promptName: 'SIG_TRIAGE_SCORE_V1',
                    inputTokens: triageResult.usage.inputTokens,
                    outputTokens: triageResult.usage.outputTokens,
                    costUsd: triageResult.usage.costUsd,
                })
            }
        } else {
            recordFailure()
        }

        // Step 8: Triage decision
        let status: 'pending' | 'flagged' | 'archived' = 'pending'
        if (significanceScore < TRIAGE_RULES.autoArchive) {
            status = 'archived'
        } else if (significanceScore >= TRIAGE_RULES.flagged) {
            status = 'flagged'
        }

        // Step 9: Signal persistence
        const signalId = await createSignal(
            clusterId,
            classifyResult.data.signal_type,
            classifyResult.data.confidence,
            significanceScore,
            status,
            classifyResult.data.notes
        )

        await logPipeline(runId, 'info', 'Signal created', {
            signalId,
            type: classifyResult.data.signal_type,
            significance: significanceScore,
            status
        })

        return { success: true, signalId, clusterId, action: 'created' }

    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        await logPipeline(runId, 'error', `Pipeline failed: ${message}`, { articleId })
        return { success: false, action: 'error', reason: message }
    }
}

/**
 * Create a new cluster with the article as primary
 */
async function createCluster(articleId: string): Promise<string> {
    const [cluster] = await db.insert(clusters).values({
        primaryArticleId: articleId,
    }).returning({ id: clusters.id })

    await db.insert(clusterArticles).values({
        clusterId: cluster.id,
        rawArticleId: articleId,
    })

    return cluster.id
}

/**
 * Add an article to an existing cluster
 */
async function addToCluster(clusterId: string, articleId: string): Promise<void> {
    await db.insert(clusterArticles).values({
        clusterId,
        rawArticleId: articleId,
    })
}

/**
 * Get the number of articles in a cluster
 */
async function getClusterSize(clusterId: string): Promise<number> {
    const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(clusterArticles)
        .where(eq(clusterArticles.clusterId, clusterId))

    return Number(result[0]?.count || 0)
}

/**
 * Create a signal for a cluster
 */
async function createSignal(
    clusterId: string,
    signalType: 'breaking' | 'repetition' | 'contradiction' | 'shift',
    confidenceScore: number,
    significanceScore: number,
    status: 'pending' | 'flagged' | 'approved' | 'archived',
    notes?: string
): Promise<string> {
    const [signal] = await db.insert(signals).values({
        clusterId,
        signalType,
        confidenceScore: Math.min(100, Math.max(0, Math.round(confidenceScore))),
        significanceScore: Math.min(100, Math.max(0, Math.round(significanceScore))),
        status,
        aiNotes: notes,
    }).returning({ id: signals.id })

    return signal.id
}

/**
 * Simple embedding cache for recent clusters (in-memory for now)
 * In production, store embeddings in the database
 */
const clusterEmbeddings: Map<string, { embedding: number[], createdAt: Date }> = new Map()

/**
 * Find matching cluster based on embedding similarity
 */
async function findMatchingCluster(
    embedding: number[],
    cutoffDate: Date
): Promise<{ match: boolean; clusterId?: string; similarity: number }> {
    // Get recent clusters
    const recentClusters = await db
        .select({
            id: clusters.id,
            articleId: clusters.primaryArticleId,
            createdAt: clusters.createdAt,
        })
        .from(clusters)
        .where(gte(clusters.createdAt, cutoffDate))
        .orderBy(desc(clusters.createdAt))
        .limit(50)

    let bestMatch = { clusterId: '', similarity: 0 }

    for (const cluster of recentClusters) {
        // Check cache first
        const cached = clusterEmbeddings.get(cluster.id)
        let clusterEmbedding: number[] | null = null

        if (cached && cached.createdAt > cutoffDate) {
            clusterEmbedding = cached.embedding
        } else {
            // Generate embedding for the cluster's primary article
            const [article] = await db
                .select({ title: rawArticles.title, bodyText: rawArticles.bodyText })
                .from(rawArticles)
                .where(eq(rawArticles.id, cluster.articleId))
                .limit(1)

            if (article) {
                const text = `${article.title}\n\n${article.bodyText.slice(0, 800)}`
                clusterEmbedding = await generateEmbedding(text)
                if (clusterEmbedding) {
                    clusterEmbeddings.set(cluster.id, { embedding: clusterEmbedding, createdAt: new Date() })
                }
            }
        }

        if (clusterEmbedding) {
            const similarity = cosineSimilarity(embedding, clusterEmbedding)
            if (similarity > bestMatch.similarity) {
                bestMatch = { clusterId: cluster.id, similarity }
            }
        }
    }

    return {
        match: bestMatch.similarity >= SIMILARITY_THRESHOLDS.candidateMatch,
        clusterId: bestMatch.clusterId || undefined,
        similarity: bestMatch.similarity,
    }
}

/**
 * Process all unprocessed articles
 */
export async function processUnprocessedArticles(): Promise<{
    processed: number
    created: number
    merged: number
    errors: number
    reasons: string[]
}> {
    const stats = { processed: 0, created: 0, merged: 0, errors: 0, reasons: [] as string[] }

    const unprocessed = await db
        .select({ id: rawArticles.id })
        .from(rawArticles)
        .where(eq(rawArticles.isProcessed, false))
        .orderBy(rawArticles.createdAt)
        .limit(50)

    for (const article of unprocessed) {
        const result = await processArticle(article.id)
        stats.processed++

        if (result.action === 'created') stats.created++
        else if (result.action === 'merged') stats.merged++
        else if (result.action === 'error') {
            stats.errors++
            if (result.reason && stats.reasons.length < 3) {
                stats.reasons.push(result.reason)
            }
        }
    }

    return stats
}

/**
 * Log pipeline events
 */
async function logPipeline(
    runId: string,
    level: string,
    message: string,
    metadata: Record<string, unknown>
): Promise<void> {
    try {
        await db.insert(logs).values({
            component: 'signal-pipeline',
            runId,
            level,
            message,
            metadata,
        })
    } catch (error) {
        console.error('Failed to log pipeline:', error)
    }
}
