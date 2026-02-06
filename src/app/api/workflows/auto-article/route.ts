import { NextResponse } from 'next/server'
import { runCompositeWorkflow } from '@/lib/composite-workflow'

/**
 * POST /api/workflows/auto-article
 *
 * Complete automated article generation workflow
 *
 * Purpose: Generate a complete article in one request
 * - Discovers a news story (discovery pipeline)
 * - Generates full article content (writing pipeline)
 * - Updates article with generated content
 * - Logs all steps for audit trail
 *
 * Workflow Steps:
 * 1. Discovery: Find top Canadian political story using Perplexity
 * 2. Create Draft: Create article record with discovered story data
 * 3. Writing: Generate full article content using discovered story
 * 4. Update: Save generated content to article record
 *
 * Logging:
 * - Console output shows step-by-step progress
 * - All steps logged to generation_runs table
 * - Clear error messages if any step fails
 *
 * Returns: { success, article, generationRunIds }
 * Errors: { error, details, generationRunIds (partial if failed mid-way) }
 */
export async function POST() {
    try {
        console.log('\n' + '='.repeat(60))
        console.log('API CALL: POST /api/workflows/auto-article')
        console.log('='.repeat(60))

        const result = await runCompositeWorkflow('discovery', 'writing')

        if (!result.success) {
            console.error('[api] Workflow failed:', result.error)
            console.error('[api] Details:', result.details)

            return NextResponse.json(
                {
                    success: false,
                    error: result.error,
                    details: result.details,
                    generationRunIds: result.generationRunIds,
                },
                { status: 500 }
            )
        }

        console.log('[api] Workflow succeeded, returning article')
        console.log(`[api] Article headline: "${result.article?.headline}"`)
        console.log(`[api] Content length: ${result.article?.content?.length || 0} characters`)

        return NextResponse.json({
            success: true,
            message: 'Auto-article workflow completed successfully',
            article: {
                id: result.article?.id,
                headline: result.article?.headline,
                slug: result.article?.slug,
                isDraft: result.article?.isDraft,
                contentLength: result.article?.content?.length || 0,
                createdAt: result.article?.createdAt,
            },
            generationRunIds: result.generationRunIds,
        })
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        console.error('[api] Uncaught error:', errorMsg)

        return NextResponse.json(
            {
                success: false,
                error: 'Workflow execution failed',
                details: errorMsg,
            },
            { status: 500 }
        )
    }
}
