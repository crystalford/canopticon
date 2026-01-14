import { NextRequest, NextResponse } from 'next/server'
import { db, sources } from '@/db'
import { eq } from 'drizzle-orm'

/**
 * POST /api/sources/[id]/disable - Disable a source
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        const [updated] = await db
            .update(sources)
            .set({ isActive: false, updatedAt: new Date() })
            .where(eq(sources.id, id))
            .returning()

        if (!updated) {
            return NextResponse.json(
                { error: 'Source not found' },
                { status: 404 }
            )
        }

        return NextResponse.json({ source: updated })
    } catch (error) {
        console.error('Error disabling source:', error)
        return NextResponse.json(
            { error: 'Failed to disable source' },
            { status: 500 }
        )
    }
}
