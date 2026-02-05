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
        console.log(`[v0] processArticle: Fetching article ${articleId}...`)
        
        // Fetch the article
        const [article] = await db
            .select()
            .from(rawArticles)
            .where(eq(rawArticles.id, articleId))
            .limit(1)

        if (!article) {
            console.error(`[v0] processArticle: Article ${articleId} not found`)
            return { success: false, action: 'error', reason: 'Article not found' }
        }

        console.log(`[v0] processArticle: Found article "${article.title.substring(0, 50)}..."`)

        if (article.isProcessed) {
            console.log(`[v0] processArticle: Article already processed`)
            return { success: true, action: 'skipped', reason: 'Already processed' }
        }

        await logPipeline(runId, 'info', 'Processing article (Manual Mode)', { articleId })

        // MANUAL MODE: No AI, No Clustering
        // 1. Create a new Cluster for this article
        console.log(`[v0] processArticle: Creating cluster...`)
        const clusterId = await createCluster(articleId)
        console.log(`[v0] processArticle: Cluster created: ${clusterId}`)

        // 2. Create a default "Pending" signal
        // Default values: Type=shift (neutral), Confidence=0, Significance=0, Status=pending
        console.log(`[v0] processArticle: Creating signal...`)
        const signalId = await createSignal(
            clusterId,
            'shift',      // default type
            0,            // 0 confidence (no AI)
            0,            // 0 significance (no AI)
            'pending', // status
            '' // notes
        )
        console.log(`[v0] processArticle: Signal created: ${signalId}`)

        // 3. Mark article as processed
        console.log(`[v0] processArticle: Marking article as processed...`)
        await db
            .update(rawArticles)
            .set({ isProcessed: true })
            .where(eq(rawArticles.id, articleId))
        console.log(`[v0] processArticle: Article marked as processed`)

        return { success: true, signalId, clusterId, action: 'created' }

    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        console.error(`[v0] processArticle: EXCEPTION:`, error)
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

/**
 * Run on-demand analysis for an existing signal
 */
export async function runSignalAnalysis(signalId: string): Promise<PipelineResult> {
    const runId = uuidv4()

    try {
        // 1. Fetch Signal and related data
        const [signal] = await db
            .select()
            .from(signals)
            .where(eq(signals.id, signalId))
            .limit(1)

        if (!signal) throw new Error('Signal not found')

        const [cluster] = await db
            .select()
            .from(clusters)
            .where(eq(clusters.id, signal.clusterId))
            .limit(1)

        // Get the primary article
        const [article] = await db
            .select()
            .from(rawArticles)
            .where(eq(rawArticles.id, cluster.primaryArticleId))
            .limit(1)

        if (!article) throw new Error('Primary article not found')

        await logPipeline(runId, 'info', 'Starting on-demand analysis', { signalId })

        // 2. Check Cost Limits
        const costCheck = await checkCostLimits(signalId)
        if (!costCheck.allowed) {
            return { success: false, action: 'error', reason: `Cost limit reached: ${costCheck.reason}` }
        }

        // 3. Generate Embedding (if strictly needed for clustering later, for now we just skip to classification)
        // We can add this back if "re-clustering" becomes a feature

        // 4. Classification
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
            throw new Error(classifyResult.error || 'Classification failed')
        }

        if (classifyResult.usage) {
            await recordAIUsage({
                signalId,
                model: 'gpt-4o-mini',
                promptName: 'SIG_CLASSIFY_V1',
                inputTokens: classifyResult.usage.inputTokens,
                outputTokens: classifyResult.usage.outputTokens,
                costUsd: classifyResult.usage.costUsd,
            })
        }

        // 5. Scoring
        const triageInput: SigTriageInput = {
            title: article.title,
            body_excerpt: article.bodyText.slice(0, 1000),
        }

        const triageResult = await callAI<SigTriageOutput>({
            prompt: SIG_TRIAGE_SCORE_V1.prompt,
            input: triageInput,
            model: 'gpt-4o-mini',
        })

        let significanceScore = 50
        if (triageResult.success && triageResult.data) {
            significanceScore = triageResult.data.significance_score
            if (triageResult.usage) {
                await recordAIUsage({
                    signalId,
                    model: 'gpt-4o-mini',
                    promptName: 'SIG_TRIAGE_SCORE_V1',
                    inputTokens: triageResult.usage.inputTokens,
                    outputTokens: triageResult.usage.outputTokens,
                    costUsd: triageResult.usage.costUsd,
                })
            }
        }

        // 6. Update Signal
        await db
            .update(signals)
            .set({
                signalType: classifyResult.data.signal_type,
                confidenceScore: Math.round(classifyResult.data.confidence),
                significanceScore: Math.round(significanceScore),
                aiNotes: classifyResult.data.notes,
                status: 'pending' // Keep as pending for approval rules to evaluate
            })
            .where(eq(signals.id, signalId))

        await logPipeline(runId, 'info', 'Analysis complete', {
            type: classifyResult.data.signal_type,
            score: significanceScore
        })

        return { success: true, signalId, action: 'merged' } // reused action type

    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        await logPipeline(runId, 'error', `Analysis failed: ${message}`, { signalId })
        return { success: false, action: 'error', reason: message }
    }
}
