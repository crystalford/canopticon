
import { db, articles, secondaryArticles, analysisReports, logs } from '@/db'
import { eq, inArray } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { callAI } from '@/lib/ai'
import { recordAIUsage } from '@/lib/ai/cost-control'
import {
    FALLACY_DETECTION_V1, FallacyDetectionInput, FallacyDetectionOutput,
    BIAS_ANALYSIS_V1, BiasAnalysisInput, BiasAnalysisOutput
} from '@/lib/ai/prompts'

/**
 * Engine B Orchestrator
 * Coordinators the analysis of secondary sources against a primary target.
 */

export async function runDiscourseAnalysis(
    targetArticleId: string,
    secondaryArticleIds: string[]
) {
    const runId = uuidv4()
    await logEngineB(runId, 'info', 'Starting Discourse Analysis', { targetArticleId, count: secondaryArticleIds.length })

    try {
        // 1. Fetch Target Article (Primary Truth)
        const [target] = await db.select().from(articles).where(eq(articles.id, targetArticleId))
        if (!target) throw new Error('Target article not found')

        // 2. Fetch Secondary Articles
        const inputs = await db.select().from(secondaryArticles).where(inArray(secondaryArticles.id, secondaryArticleIds))
        if (inputs.length === 0) throw new Error('No secondary articles found')

        const fallaciesAccumulator: any[] = []
        const biasAccumulator: any[] = []
        const usedSourceIds: string[] = []

        // 3. Analyze each secondary source
        for (const input of inputs) {
            // A. Fallacy Detection
            const fallacyResult = await callAI<FallacyDetectionOutput>({
                prompt: FALLACY_DETECTION_V1.prompt,
                input: {
                    text_content: input.content.slice(0, 2000), // Limit context
                    context: `Author: ${input.author}, Source: ${input.originalUrl}`
                },
                model: 'gpt-4o-mini'
            })

            if (fallacyResult.success && fallacyResult.data) {
                // Determine severity from count/severity
                fallacyResult.data.fallacies.forEach(f => {
                    fallaciesAccumulator.push({
                        ...f,
                        sourceId: input.id,
                        sourceTitle: input.title
                    })
                })

                if (fallacyResult.usage) {
                    await recordAIUsage({
                        model: 'gpt-4o-mini',
                        promptName: 'FALLACY_DETECTION_V1',
                        inputTokens: fallacyResult.usage.inputTokens,
                        outputTokens: fallacyResult.usage.outputTokens,
                        costUsd: fallacyResult.usage.costUsd
                    })
                }
            }

            // B. Bias Analysis
            const biasResult = await callAI<BiasAnalysisOutput>({
                prompt: BIAS_ANALYSIS_V1.prompt,
                input: { text_content: input.content.slice(0, 2000) },
                model: 'gpt-4o-mini'
            })

            if (biasResult.success && biasResult.data) {
                biasAccumulator.push({
                    sourceId: input.id,
                    sourceTitle: input.title,
                    ...biasResult.data
                })

                if (biasResult.usage) {
                    await recordAIUsage({
                        model: 'gpt-4o-mini',
                        promptName: 'BIAS_ANALYSIS_V1',
                        inputTokens: biasResult.usage.inputTokens,
                        outputTokens: biasResult.usage.outputTokens,
                        costUsd: biasResult.usage.costUsd
                    })
                }
            }

            usedSourceIds.push(input.id)
        }

        // 4. Synthesize Report
        // For MVP, we simply aggregate the list. In v2, we'd have AI summarize the aggregate.

        // Narrative generation (simple rule-based for now)
        let biasSummary = `Analyzed ${inputs.length} secondary sources. `
        const distinctDirections = new Set(biasAccumulator.map(b => b.bias_direction))
        biasSummary += `Detected perspectives: ${Array.from(distinctDirections).join(', ')}. `

        // 5. Save Report
        const [report] = await db.insert(analysisReports).values({
            targetArticleId: targetArticleId,
            status: 'approved', // Auto-approve for MVP
            fallaciesDetected: fallaciesAccumulator,
            biasAnalysis: biasSummary, // Storing the narrative
            contradictions: biasAccumulator, // Using contradictions field to store the detailed bias reports for now (schema reuse)
            sourcesUsed: usedSourceIds
        }).returning()

        return report

    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        await logEngineB(runId, 'error', `Analysis failed: ${message}`, { targetArticleId })
        throw error
    }
}

async function logEngineB(runId: string, level: string, message: string, metadata: any) {
    await db.insert(logs).values({
        component: 'engine-b',
        runId,
        level,
        message,
        metadata
    })
}
