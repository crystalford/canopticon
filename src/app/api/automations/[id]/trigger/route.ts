
import { db } from '@/db'
import { automations } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { runAutomation } from '@/lib/automations/runner'

export const dynamic = 'force-dynamic'

export async function POST(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const { id } = params
        const body = await req.json().catch(() => ({}))
        const ignoreLastRun = body.ignoreLastRun === true

        const [automation] = await db.select().from(automations).where(eq(automations.id, id))

        if (!automation) {
            return NextResponse.json({ error: 'Automation not found' }, { status: 404 })
        }

        // If force run, checking logic usually inside runAutomation.
        // But runAutomation uses automation.lastRunAt.
        // We can temporarily modify the automation object passed to runAutomation.

        const automationToRun = {
            ...automation,
            lastRunAt: ignoreLastRun ? null : automation.lastRunAt
        }

        const result = await runAutomation(automationToRun)

        return NextResponse.json(result)

    } catch (error) {
        console.error('Manual trigger failed:', error)
        return NextResponse.json({ error: String(error) }, { status: 500 })
    }
}
