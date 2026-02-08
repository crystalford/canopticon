import { NextResponse } from 'next/server'
import { db, conversations } from '@/db'
import { eq } from 'drizzle-orm'

export async function PATCH(
    req: Request,
    { params }: { params: { id: string } }
) {
    const { id } = params
    const body = await req.json()
    const updates: Record<string, unknown> = { updatedAt: new Date() }

    if (body.title !== undefined) updates.title = body.title
    if (body.pinned !== undefined) updates.pinned = body.pinned

    await db.update(conversations).set(updates).where(eq(conversations.id, id))

    return NextResponse.json({ success: true })
}

export async function DELETE(
    _req: Request,
    { params }: { params: { id: string } }
) {
    const { id } = params

    // Messages cascade-delete via FK constraint
    await db.delete(conversations).where(eq(conversations.id, id))

    return NextResponse.json({ success: true })
}
