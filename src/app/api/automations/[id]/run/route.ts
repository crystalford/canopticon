import { NextResponse } from 'next/server'
import { db, automations } from '@/db'
import { eq } from 'drizzle-orm'
import { runAutomation } from '@/lib/automations/runner'

export const maxDuration = 60

export async function POST(
    _req: Request,
    { params }: { params: { id: string } }
) {
    const { id } = params

    const automation = await db.query.automations.findFirst({
        where: eq(automations.id, id),
    })

    if (!automation) {
        return NextResponse.json({ error: 'Monitor not found' }, { status: 404 })
    }

    const result = await runAutomation(automation)

    return NextResponse.json(result)
}
