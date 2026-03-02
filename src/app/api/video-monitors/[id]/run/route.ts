import { NextResponse } from 'next/server'
import { db, automations } from '@/db'
import { eq } from 'drizzle-orm'
import { runVideoMonitor } from '@/lib/videos/pipeline'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(req: Request, { params }: { params: { id: string } }) {
    try {
        const { searchParams } = new URL(req.url)
        const force = searchParams.get('force') === 'true'

        const automation = await db.query.automations.findFirst({
            where: eq(automations.id, params.id)
        })
        if (!automation) return NextResponse.json({ error: 'Monitor not found' }, { status: 404 })

        const result = await runVideoMonitor(automation, { force })
        return NextResponse.json(result)
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
