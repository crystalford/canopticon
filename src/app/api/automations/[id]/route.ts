import { NextResponse } from 'next/server'
import { db, automations } from '@/db'
import { eq } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth'

export async function GET(
    req: Request,
    { params }: { params: { id: string } }
) {
    const authError = await requireAuth(req)
    if (authError) return authError

    try {
        const automation = await db.query.automations.findFirst({
            where: eq(automations.id, params.id),
        })
        if (!automation) return NextResponse.json({ error: 'Not found' }, { status: 404 })
        return NextResponse.json(automation)
    } catch {
        return NextResponse.json({ error: 'Failed' }, { status: 500 })
    }
}

export async function PATCH(
    req: Request,
    { params }: { params: { id: string } }
) {
    const authError = await requireAuth(req)
    if (authError) return authError

    try {
        const body = await req.json()
        const allowed = ['name', 'prompt', 'enabled', 'autoPublish', 'config']
        const updates: any = {}
        for (const key of allowed) {
            if (key in body) updates[key] = body[key]
        }
        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'No valid fields' }, { status: 400 })
        }

        // Merge config instead of overwriting — so saving xThreadPrompt doesn't wipe channelId
        if (updates.config) {
            const existing = await db.query.automations.findFirst({ where: eq(automations.id, params.id) })
            if (existing) {
                updates.config = { ...(existing.config as object || {}), ...updates.config }
            }
        }

        updates.updatedAt = new Date()
        const [updated] = await db.update(automations).set(updates).where(eq(automations.id, params.id)).returning()
        return NextResponse.json(updated)
    } catch {
        return NextResponse.json({ error: 'Failed' }, { status: 500 })
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: { id: string } }
) {
    const authError = await requireAuth(req)
    if (authError) return authError

    try {
        await db.delete(automations).where(eq(automations.id, params.id))
        return NextResponse.json({ success: true })
    } catch {
        return NextResponse.json({ error: 'Failed' }, { status: 500 })
    }
}
