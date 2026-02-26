import { NextResponse } from 'next/server'
import { db, automations } from '@/db'
import { eq } from 'drizzle-orm'
import { runAutomation } from '@/lib/automations/runner'
import { requireAuth } from '@/lib/auth'

export const maxDuration = 120

export async function POST(
    req: Request,
    { params }: { params: { id: string } }
) {
    const authError = await requireAuth(req)
    if (authError) return authError

    const { id } = params

    const automation = await db.query.automations.findFirst({
        where: eq(automations.id, id),
    })

    if (!automation) {
        return NextResponse.json({ error: 'Monitor not found' }, { status: 404 })
    }

    const { force } = await req.json().catch(() => ({}))

    const runConfig = {
        ...automation,
        lastRunAt: force ? null : automation.lastRunAt
    }

    const result = await runAutomation(runConfig)

    return NextResponse.json(result)
}
