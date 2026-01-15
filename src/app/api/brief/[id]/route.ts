import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { db, briefs } from '@/db'
import { eq } from 'drizzle-orm'

/**
 * DELETE /api/brief/[id] - Delete a brief
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession()
        if (!session) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            )
        }

        const { id } = await params

        const [deletedBrief] = await db
            .delete(briefs)
            .where(eq(briefs.id, id))
            .returning()

        if (!deletedBrief) {
            return NextResponse.json(
                { error: 'Brief not found' },
                { status: 404 }
            )
        }

        console.log('Brief deleted:', deletedBrief.id)
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting brief:', error)
        return NextResponse.json(
            { error: `Failed to delete brief: ${error}` },
            { status: 500 }
        )
    }
}
