import { NextResponse } from 'next/server'
import { db, sources } from '@/db'
import { desc } from 'drizzle-orm'

/**
 * GET /api/sources - List all sources
 */
export async function GET() {
    try {
        const result = await db
            .select()
            .from(sources)
            .orderBy(desc(sources.createdAt))

        return NextResponse.json({ sources: result })
    } catch (error) {
        console.error('Error fetching sources:', error)
        return NextResponse.json(
            { error: 'Failed to fetch sources' },
            { status: 500 }
        )
    }
}
