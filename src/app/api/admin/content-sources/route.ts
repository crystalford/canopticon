import { NextRequest, NextResponse } from 'next/server'
import { db, contentSources, pipelineConfig } from '@/db'
import { eq } from 'drizzle-orm'

/**
 * GET /api/admin/content-sources
 * List all content sources with associated workflow names
 *
 * Data Flow:
 * 1. Fetch all content sources from database
 * 2. For each source, look up associated workflow name
 * 3. Return enriched data with source + workflow details
 *
 * Returns: { sources: ContentSource[] }
 * Errors: 500 if database query fails
 */
export async function GET() {
    try {
        console.log('[content-sources] GET: Starting fetch of all sources')

        const sources = await db
            .select({
                id: contentSources.id,
                type: contentSources.type,
                name: contentSources.name,
                config: contentSources.config,
                workflowId: contentSources.workflowId,
                isActive: contentSources.isActive,
                lastTriggeredAt: contentSources.lastTriggeredAt,
                createdAt: contentSources.createdAt,
            })
            .from(contentSources)
            .orderBy(contentSources.createdAt)

        console.log(`[content-sources] GET: Fetched ${sources.length} sources from database`)

        // Enrich with workflow names
        const enriched = await Promise.all(
            sources.map(async (source) => {
                const workflow = await db
                    .select({ task: pipelineConfig.task })
                    .from(pipelineConfig)
                    .where(eq(pipelineConfig.id, source.workflowId))
                    .limit(1)

                const workflowName = workflow[0]?.task || 'Unknown'
                console.log(
                    `[content-sources] GET: Enriched source "${source.name}" with workflow "${workflowName}"`
                )

                return {
                    ...source,
                    workflowName,
                }
            })
        )

        console.log('[content-sources] GET: Successfully fetched all sources')
        return NextResponse.json({ sources: enriched })
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        console.error('[content-sources] GET: ERROR -', errorMsg)
        return NextResponse.json(
            {
                error: 'Failed to fetch content sources',
                details: errorMsg,
            },
            { status: 500 }
        )
    }
}

/**
 * POST /api/admin/content-sources
 * Create a new content source
 *
 * Data Flow:
 * 1. Validate request body (name, type, config, workflowId)
 * 2. Check that referenced workflow exists
 * 3. Create source record in database
 * 4. Return created source
 *
 * Request body: { name, type, config, workflowId }
 * Returns: { source: ContentSource }
 * Errors:
 * - 400: Missing required fields or invalid workflow
 * - 500: Database error
 */
export async function POST(req: NextRequest) {
    try {
        console.log('[content-sources] POST: Starting source creation')

        const body = await req.json()
        const { name, type, config, workflowId } = body

        console.log(
            `[content-sources] POST: Received request - name="${name}", type="${type}", workflow="${workflowId}"`
        )

        // Validation
        if (!name || !type || !config || !workflowId) {
            console.error('[content-sources] POST: Missing required fields', {
                name: !!name,
                type: !!type,
                config: !!config,
                workflowId: !!workflowId,
            })
            return NextResponse.json(
                { error: 'Missing required fields: name, type, config, workflowId' },
                { status: 400 }
            )
        }

        // Validate that workflow exists
        console.log(`[content-sources] POST: Validating workflow exists (id="${workflowId}")`)
        const workflow = await db
            .select({ id: pipelineConfig.id })
            .from(pipelineConfig)
            .where(eq(pipelineConfig.id, workflowId))
            .limit(1)

        if (!workflow[0]) {
            console.error(`[content-sources] POST: Workflow not found (id="${workflowId}")`)
            return NextResponse.json(
                { error: `Workflow not found: ${workflowId}` },
                { status: 400 }
            )
        }

        console.log('[content-sources] POST: Workflow validated, creating source')

        // Create source
        const [newSource] = await db
            .insert(contentSources)
            .values({
                name,
                type,
                config,
                workflowId,
                isActive: true,
            })
            .returning()

        console.log(`[content-sources] POST: Source created successfully (id="${newSource.id}", name="${newSource.name}")`)

        return NextResponse.json({ source: newSource }, { status: 201 })
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        console.error('[content-sources] POST: ERROR -', errorMsg, error)
        return NextResponse.json(
            {
                error: 'Failed to create content source',
                details: errorMsg,
            },
            { status: 500 }
        )
    }
}

/**
 * PATCH /api/admin/content-sources?id=xxx
 * Update an existing content source
 *
 * Data Flow:
 * 1. Extract source ID from query params
 * 2. Validate source exists
 * 3. Update specified fields
 * 4. Return updated source
 *
 * Query params: ?id=<sourceId>
 * Request body: { name?, type?, config?, workflowId?, isActive? }
 * Returns: { source: ContentSource }
 * Errors:
 * - 400: Missing source ID
 * - 404: Source not found
 * - 500: Database error
 */
export async function PATCH(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const id = searchParams.get('id')

        console.log(`[content-sources] PATCH: Starting update (id="${id}")`)

        if (!id) {
            console.error('[content-sources] PATCH: Source ID missing from query params')
            return NextResponse.json({ error: 'Source ID required' }, { status: 400 })
        }

        const body = await req.json()
        console.log(`[content-sources] PATCH: Received update data for source "${id}"`)

        // Update source
        const [updatedSource] = await db
            .update(contentSources)
            .set({
                ...(body.name !== undefined && { name: body.name }),
                ...(body.type !== undefined && { type: body.type }),
                ...(body.config !== undefined && { config: body.config }),
                ...(body.workflowId !== undefined && { workflowId: body.workflowId }),
                ...(body.isActive !== undefined && { isActive: body.isActive }),
                updatedAt: new Date(),
            })
            .where(eq(contentSources.id, id))
            .returning()

        if (!updatedSource) {
            console.error(`[content-sources] PATCH: Source not found (id="${id}")`)
            return NextResponse.json({ error: 'Source not found' }, { status: 404 })
        }

        console.log(
            `[content-sources] PATCH: Source updated successfully (id="${id}", name="${updatedSource.name}")`
        )

        return NextResponse.json({ source: updatedSource })
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        console.error('[content-sources] PATCH: ERROR -', errorMsg)
        return NextResponse.json(
            {
                error: 'Failed to update content source',
                details: errorMsg,
            },
            { status: 500 }
        )
    }
}

/**
 * DELETE /api/admin/content-sources?id=xxx
 * Delete a content source
 *
 * Data Flow:
 * 1. Extract source ID from query params
 * 2. Delete the source from database
 * 3. Return success confirmation
 *
 * Query params: ?id=<sourceId>
 * Returns: { success: true }
 * Errors:
 * - 400: Missing source ID
 * - 500: Database error
 */
export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const id = searchParams.get('id')

        console.log(`[content-sources] DELETE: Starting deletion (id="${id}")`)

        if (!id) {
            console.error('[content-sources] DELETE: Source ID missing from query params')
            return NextResponse.json({ error: 'Source ID required' }, { status: 400 })
        }

        // Get source name for logging before delete
        const sourceToDelete = await db
            .select({ name: contentSources.name })
            .from(contentSources)
            .where(eq(contentSources.id, id))
            .limit(1)

        const sourceName = sourceToDelete[0]?.name || 'Unknown'

        // Delete source
        await db.delete(contentSources).where(eq(contentSources.id, id))

        console.log(`[content-sources] DELETE: Source deleted successfully (id="${id}", name="${sourceName}")`)

        return NextResponse.json({ success: true })
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        console.error('[content-sources] DELETE: ERROR -', errorMsg)
        return NextResponse.json(
            {
                error: 'Failed to delete content source',
                details: errorMsg,
            },
            { status: 500 }
        )
    }
}
