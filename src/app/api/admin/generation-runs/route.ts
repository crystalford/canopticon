import { NextResponse } from 'next/server'
import { db, generationRuns, prompts, aiProviders } from '@/db'
import { desc } from 'drizzle-orm'

/**
 * GET /api/admin/generation-runs
 * List all generation runs with full context
 *
 * Query params:
 * - task: Filter by task type (discovery, writing, etc)
 * - status: Filter by status (success, error)
 * - limit: How many to return (default 100)
 *
 * Returns: { runs: GenerationRun[] }
 */
export async function GET(request: Request) {
    const startTime = Date.now()
    const url = new URL(request.url)
    const taskFilter = url.searchParams.get('task')
    const statusFilter = url.searchParams.get('status')
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500)

    console.log(`[generation-runs] GET: Fetching runs (task=${taskFilter}, status=${statusFilter}, limit=${limit})...`)

    try {
        let query = db.select().from(generationRuns)

        // Add filters if provided
        if (taskFilter) {
            // Note: This is a simplification - would need proper WHERE clause in real impl
            // For now, we filter in memory
        }
        if (statusFilter) {
            // Same here
        }

        // Always sort newest first
        const allRuns = await query.orderBy(desc(generationRuns.createdAt))

        // Filter in memory (simple approach)
        let filtered = allRuns
        if (taskFilter) {
            filtered = filtered.filter(r => r.task === taskFilter)
        }
        if (statusFilter) {
            filtered = filtered.filter(r => r.status === statusFilter)
        }

        // Apply limit
        const runs = filtered.slice(0, limit)

        const elapsed = Date.now() - startTime
        console.log(`[generation-runs] GET: Found ${runs.length} runs in ${elapsed}ms`)

        return NextResponse.json({ runs })
    } catch (error) {
        const elapsed = Date.now() - startTime
        const errorMsg = error instanceof Error ? error.message : String(error)
        console.error(`[generation-runs] GET: ERROR after ${elapsed}ms - ${errorMsg}`)

        return NextResponse.json(
            {
                error: 'Failed to fetch generation runs',
                details: errorMsg,
            },
            { status: 500 }
        )
    }
}
