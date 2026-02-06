import { NextResponse } from 'next/server'
import { pipelineRunner } from '@/lib/pipeline-runner'
import { discoverStories } from '@/lib/pipelines/discovery'
import { createDraftArticle } from '@/lib/pipelines/create-draft-article'
import { AIClient } from '@/lib/ai-client'

/**
 * POST /api/pipeline/discover
 * Trigger the discovery pipeline to find Canadian political stories
 *
 * This endpoint:
 * 1. Runs the 'discovery' pipeline (looks up config from database)
 * 2. Uses Perplexity to discover today's top Canadian political story
 * 3. Creates a draft article from the discovered story
 * 4. Logs everything to generation_runs for audit trail
 */
export async function POST() {
    try {
        // Run the discovery pipeline
        // The handler receives the configured AI client and prompt
        const result = await pipelineRunner.runPipeline(
            'discovery',
            async (client: AIClient, promptText: string) => {
                // Execute discovery with configured client and prompt
                const story = await discoverStories(client, promptText)

                // Create draft article from discovered story
                const article = await createDraftArticle(story)

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
            return NextResponse.json(
                { error: result.error || 'Discovery failed' },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            message: 'Discovery pipeline completed',
            data: result.output,
            generationRunId: result.generationRunId,
        })
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error('Discovery pipeline error:', message)
        return NextResponse.json(
            { error: 'Discovery pipeline failed', details: message },
            { status: 500 }
        )
    }
}
