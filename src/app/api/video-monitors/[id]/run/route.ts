import { NextResponse } from 'next/server'
import { db, automations } from '@/db'
import { eq } from 'drizzle-orm'
import { runVideoMonitor } from '@/lib/videos/pipeline'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(_req: Request, { params }: { params: { id: string } }) {
    try {
        const automation = await db.query.automations.findFirst({
            where: eq(automations.id, params.id)
        })
        if (!automation) return NextResponse.json({ error: 'Monitor not found' }, { status: 404 })

        const result = await runVideoMonitor(automation)
        return NextResponse.json(result)
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
