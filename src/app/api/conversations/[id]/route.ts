import { NextResponse } from 'next/server'
import { db, conversations, messages } from '@/db'
import { eq } from 'drizzle-orm'

export async function DELETE(
    _req: Request,
    { params }: { params: { id: string } }
) {
    const { id } = params

    // Messages cascade-delete via FK constraint
    await db.delete(conversations).where(eq(conversations.id, id))

    return NextResponse.json({ success: true })
}
