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

export async function POST(req: Request) {
    try {
        const { name, type, config, prompt, autoPublish, enabled } = await req.json()
        if (!name || !type || !config) {
            return NextResponse.json({ error: 'name, type, and config are required' }, { status: 400 })
        }
        const [automation] = await db.insert(automations).values({
            name,
            type,
            config,
            prompt: prompt || '',
            autoPublish: autoPublish ?? false,
            enabled: enabled ?? true,
        }).returning()
        return NextResponse.json(automation, { status: 201 })
    } catch (e: any) {
        console.error('[POST /api/automations]', e)
        return NextResponse.json({ error: e.message || 'Failed to create pipeline' }, { status: 500 })
    }
}
