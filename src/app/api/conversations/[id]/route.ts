import { NextResponse } from 'next/server'
import { db, conversations } from '@/db'
import { eq } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth'

export async function PATCH(
    req: Request,
    { params }: { params: { id: string } }
) {
    const authError = await requireAuth(req)
    if (authError) return authError

    const { id } = params
    const body = await req.json()
    const updates: Record<string, unknown> = { updatedAt: new Date() }

    if (body.title !== undefined) updates.title = body.title
    if (body.pinned !== undefined) updates.pinned = body.pinned

    await db.update(conversations).set(updates).where(eq(conversations.id, id))

    return NextResponse.json({ success: true })
}

export async function DELETE(
    req: Request,
    { params }: { params: { id: string } }
) {
    const authError = await requireAuth(req)
    if (authError) return authError

    const { id } = params

    // Messages cascade-delete via FK constraint
    await db.delete(conversations).where(eq(conversations.id, id))

    return NextResponse.json({ success: true })
}
