import { NextResponse, NextRequest } from 'next/server'
import { pipelineRunner } from '@/lib/pipeline-runner'
import { discoverStories } from '@/lib/pipelines/discovery'
import { createDraftArticle } from '@/lib/pipelines/create-draft-article'
import { AIClient } from '@/lib/ai-client'

/**
 * POST /api/workflows/[task]
 * Dynamic workflow trigger endpoint
 *
 * Usage:
 * POST /api/workflows/discovery - Run discovery workflow
 * POST /api/workflows/writing - Run writing workflow
 * POST /api/workflows/auto-article - Run composite workflow
 *
 * Routes to the correct handler based on task name
 */
export async function POST(
    request: NextRequest,
    { params }: { params: { task: string } }
) {
    const task = params.task

    console.log(`[workflows] POST: Received request for task="${task}"`)

    try {
        if (task === 'discovery') {
            // Discovery workflow: find story → create draft article
            const result = await pipelineRunner.runPipeline(
                'discovery',
                async (client: AIClient, promptText: string) => {
                    const story = await discoverStories(client, promptText)
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
                message: 'Discovery workflow completed',
                data: result.output,
                generationRunId: result.generationRunId,
            })
        } else if (task === 'auto-article') {
            // Composite workflow: discovery → writing → editing
            // For now, just run discovery (writing/editing can be added later)
            const result = await pipelineRunner.runPipeline(
                'discovery',
                async (client: AIClient, promptText: string) => {
                    const story = await discoverStories(client, promptText)
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
                    { error: result.error || 'Auto-article workflow failed' },
                    { status: 500 }
                )
            }

            return NextResponse.json({
                success: true,
                message: 'Auto-article workflow completed',
                data: result.output,
                generationRunId: result.generationRunId,
            })
        } else {
            return NextResponse.json(
                {
                    error: `Unknown task: ${task}`,
                    details: 'Supported tasks: discovery, writing, auto-article',
                },
                { status: 404 }
            )
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(`[workflows] POST: Error for task="${task}":`, message)
        return NextResponse.json(
            {
                error: `Workflow "${task}" failed`,
                details: message,
            },
            { status: 500 }
        )
    }
}
