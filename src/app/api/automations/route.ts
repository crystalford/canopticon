import { NextResponse } from 'next/server'
import { db, automations } from '@/db'
import { desc } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
    const authError = await requireAuth(req)
    if (authError) return authError

    const results = await db.query.automations.findMany({
        orderBy: [desc(automations.createdAt)],
    })
    return NextResponse.json(results)
}

export async function POST(req: Request) {
    const authError = await requireAuth(req)
    if (authError) return authError

    try {
        const { name, type, config, prompt, autoPublish, enabled } = await req.json()
        if (!name || !type || !config) {
            return NextResponse.json({ error: 'name, type, and config are required' }, { status: 400 })
        }

        // Duplicate guard: reject if same type + key config already exists
        const existing = await db.query.automations.findMany()
        const duplicate = existing.find(a => {
            if (a.type !== type) return false
            const c = a.config as Record<string, unknown>
            if (type === 'youtube') return c.channelId === config.channelId
            if (type === 'rss') return c.feedUrl === config.feedUrl
            if (type === 'keyword') return JSON.stringify(c.keywords) === JSON.stringify(config.keywords)
            return false
        })
        if (duplicate) {
            return NextResponse.json({ error: `A pipeline for this ${type} source already exists: "${duplicate.name}"`, existing: duplicate }, { status: 409 })
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
