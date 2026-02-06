import { NextRequest, NextResponse } from 'next/server'
import { db, pipelineConfig, aiProviders, prompts } from '@/db'
import { eq } from 'drizzle-orm'

/**
 * GET /api/admin/pipeline-config
 * List all pipeline configurations
 */
export async function GET() {
    try {
        const configs = await db
            .select({
                id: pipelineConfig.id,
                task: pipelineConfig.task,
                model: pipelineConfig.model,
                providerId: pipelineConfig.providerId,
                promptId: pipelineConfig.promptId,
                createdAt: pipelineConfig.createdAt,
            })
            .from(pipelineConfig)
            .orderBy(pipelineConfig.createdAt)

        // Enrich with provider and prompt names
        const enriched = await Promise.all(
            configs.map(async (config) => {
                const provider = await db
                    .select({ name: aiProviders.name })
                    .from(aiProviders)
                    .where(eq(aiProviders.id, config.providerId))
                    .limit(1)

                const prompt = await db
                    .select({ name: prompts.name })
                    .from(prompts)
                    .where(eq(prompts.id, config.promptId))
                    .limit(1)

                return {
                    ...config,
                    providerName: provider[0]?.name || 'Unknown',
                    promptName: prompt[0]?.name || 'Unknown',
                }
            })
        )

        return NextResponse.json({ configs: enriched })
    } catch (error) {
        console.error('Error fetching pipeline configs:', error)
        return NextResponse.json(
            { error: 'Failed to fetch configs' },
            { status: 500 }
        )
    }
}

/**
 * POST /api/admin/pipeline-config
 * Create new pipeline configuration
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { task, providerId, model, promptId } = body

        if (!task || !providerId || !model || !promptId) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            )
        }

        const [newConfig] = await db
            .insert(pipelineConfig)
            .values({
                task,
                providerId,
                model,
                promptId,
            })
            .returning()

        return NextResponse.json({ config: newConfig }, { status: 201 })
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error('Error creating pipeline config:', message)
        return NextResponse.json(
            { error: 'Failed to create config', details: message },
            { status: 500 }
        )
    }
}

/**
 * PATCH /api/admin/pipeline-config
 * Update pipeline configuration
 */
export async function PATCH(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const id = searchParams.get('id')

        if (!id) {
            return NextResponse.json(
                { error: 'Config ID required' },
                { status: 400 }
            )
        }

        const body = await req.json()
        const { task, providerId, model, promptId } = body

        const [updatedConfig] = await db
            .update(pipelineConfig)
            .set({
                ...(task !== undefined && { task }),
                ...(providerId !== undefined && { providerId }),
                ...(model !== undefined && { model }),
                ...(promptId !== undefined && { promptId }),
                updatedAt: new Date(),
            })
            .where(eq(pipelineConfig.id, id))
            .returning()

        if (!updatedConfig) {
            return NextResponse.json(
                { error: 'Config not found' },
                { status: 404 }
            )
        }

        return NextResponse.json({ config: updatedConfig })
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error('Error updating pipeline config:', message)
        return NextResponse.json(
            { error: 'Failed to update config', details: message },
            { status: 500 }
        )
    }
}

/**
 * DELETE /api/admin/pipeline-config
 * Delete pipeline configuration
 */
export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const id = searchParams.get('id')

        if (!id) {
            return NextResponse.json(
                { error: 'Config ID required' },
                { status: 400 }
            )
        }

        await db.delete(pipelineConfig).where(eq(pipelineConfig.id, id))

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting pipeline config:', error)
        return NextResponse.json(
            { error: 'Failed to delete config' },
            { status: 500 }
        )
    }
}
