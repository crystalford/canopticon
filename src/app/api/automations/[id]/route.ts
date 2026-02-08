import { NextResponse } from 'next/server'
import { db, automations } from '@/db'
import { eq } from 'drizzle-orm'

export async function PATCH(
    req: Request,
    { params }: { params: { id: string } }
) {
    const { id } = params
    const body = await req.json()
    const updates: Record<string, unknown> = { updatedAt: new Date() }

    if (body.enabled !== undefined) updates.enabled = body.enabled
    if (body.name !== undefined) updates.name = body.name
    if (body.prompt !== undefined) updates.prompt = body.prompt
    if (body.config !== undefined) updates.config = body.config
    if (body.autoPublish !== undefined) updates.autoPublish = body.autoPublish

    await db.update(automations).set(updates).where(eq(automations.id, id))

    return NextResponse.json({ success: true })
}

export async function DELETE(
    _req: Request,
    { params }: { params: { id: string } }
) {
    const { id } = params

    await db.delete(automations).where(eq(automations.id, id))

    return NextResponse.json({ success: true })
}
