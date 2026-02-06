import { AIClient } from '@/lib/ai-client'
import { pipelineRunner } from '@/lib/pipeline-runner'
import { discoverStories } from '@/lib/pipelines/discovery'
import { createDraftArticle } from '@/lib/pipelines/create-draft-article'
import { writeArticle } from '@/lib/pipelines/writing'
import { db, generationRuns } from '@/db'
import { eq } from 'drizzle-orm'

/**
 * Composite Workflow Orchestrator
 *
 * Purpose: Chain multiple pipeline steps together (discovery → writing)
 * Runs as a single atomic operation with comprehensive logging
 *
 * Data Flow:
 * 1. Run discovery pipeline
 *    ↓ Gets: headline, summary, topics, significance
 * 2. Create draft article
 *    ↓ Creates: article record with discovered story data
 * 3. Run writing pipeline
 *    ↓ Gets: full article content
 * 4. Update article with content
 *    ↓ Result: Complete article ready for editing/publishing
 *
 * Success: Returns final article with generated content
 * Failure: Returns error with clear indication of which step failed
 *
 * All steps logged to console and generation_runs table for audit trail
 */

interface CompositeWorkflowResult {
    success: boolean
    article?: any
    error?: string
    details?: string
    generationRunIds?: string[]
}

/**
 * Execute composite workflow: discovery → writing
 *
 * @param discoveryTask - Name of discovery task (e.g., "discovery")
 * @param writingTask - Name of writing task (e.g., "writing")
 * @returns Result with final article or error details
 */
export async function runCompositeWorkflow(
    discoveryTask: string,
    writingTask: string
): Promise<CompositeWorkflowResult> {
    const generationRunIds: string[] = []

    try {
        console.log('========================================')
        console.log('[composite] STARTING COMPOSITE WORKFLOW')
        console.log('========================================')
        console.log(`[composite] Discovery task: "${discoveryTask}"`)
        console.log(`[composite] Writing task: "${writingTask}"`)

        // ============================================================
        // STEP 1: DISCOVERY
        // ============================================================
        console.log('\n[composite] STEP 1: RUNNING DISCOVERY')
        console.log('---')

        let discoveryResult: any
        let articleId: string

        try {
            const result = await pipelineRunner.runPipeline(
                discoveryTask,
                async (client: AIClient, promptText: string) => {
                    console.log('[composite/discovery] Discovering story...')

                    const story = await discoverStories(client, promptText)
                    console.log(`[composite/discovery] Story discovered: "${story.headline}"`)

                    const article = await createDraftArticle(story)
                    console.log(`[composite/discovery] Draft article created (id="${article.id}")`)

                    return {
                        story,
                        article: {
                            id: article.id,
                            slug: article.slug,
                            headline: article.headline,
                            isDraft: article.isDraft,
                        },
                    }
                }
            )

            if (!result.success) {
                throw new Error(result.error || 'Discovery pipeline failed')
            }

            discoveryResult = result
            articleId = result.output.article.id
            if (result.generationRunId) {
                generationRunIds.push(result.generationRunId)
            }

            console.log(`[composite] ✅ Discovery complete`)
            console.log(
                `[composite]    Article ID: "${articleId}"`
            )
            console.log(
                `[composite]    Headline: "${result.output.article.headline}"`
            )
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error)
            console.error('[composite] ❌ Discovery failed:', errorMsg)
            return {
                success: false,
                error: 'Discovery pipeline failed',
                details: errorMsg,
                generationRunIds,
            }
        }

        // ============================================================
        // STEP 2: WRITING
        // ============================================================
        console.log('\n[composite] STEP 2: RUNNING WRITING')
        console.log('---')

        let writingResult: any

        try {
            const result = await pipelineRunner.runPipeline(
                writingTask,
                async (client: AIClient, promptText: string) => {
                    console.log('[composite/writing] Generating article content...')

                    const article = await writeArticle(client, promptText, {
                        story: discoveryResult.output.story,
                        articleId,
                    })

                    console.log(
                        `[composite/writing] Article content generated (${article.content?.length || 0} characters)`
                    )

                    return {
                        article: {
                            id: article.id,
                            slug: article.slug,
                            headline: article.headline,
                            contentLength: article.content?.length || 0,
                            isDraft: article.isDraft,
                        },
                    }
                }
            )

            if (!result.success) {
                throw new Error(result.error || 'Writing pipeline failed')
            }

            writingResult = result
            if (result.generationRunId) {
                generationRunIds.push(result.generationRunId)
            }

            console.log(`[composite] ✅ Writing complete`)
            console.log(
                `[composite]    Content length: ${result.output.article.contentLength} characters`
            )
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error)
            console.error('[composite] ❌ Writing failed:', errorMsg)
            console.error('[composite] Note: Draft article was created, but content was not generated')
            return {
                success: false,
                error: 'Writing pipeline failed',
                details: errorMsg,
                generationRunIds,
            }
        }

        // ============================================================
        // SUCCESS
        // ============================================================
        console.log('\n========================================')
        console.log('[composite] ✅ WORKFLOW COMPLETE')
        console.log('========================================')
        console.log(`[composite] Final article ID: "${articleId}"`)
        console.log(`[composite] Generation runs: ${generationRunIds.length}`)
        console.log(`[composite] Status: Ready for editing/publishing`)

        // Fetch final article state
        const finalArticle = await db.query.articles.findFirst({
            where: eq(articles.id, articleId),
        })

        return {
            success: true,
            article: finalArticle,
            generationRunIds,
        }
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        console.error('\n[composite] ❌ FATAL ERROR:', errorMsg)
        return {
            success: false,
            error: 'Workflow execution failed',
            details: errorMsg,
            generationRunIds,
        }
    }
}
