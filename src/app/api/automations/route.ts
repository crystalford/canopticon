import { NextResponse } from 'next/server'
import { db, automations } from '@/db'
import { desc } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET() {
    const results = await db.query.automations.findMany({
        orderBy: [desc(automations.createdAt)],
    })

    return NextResponse.json(results)
}
