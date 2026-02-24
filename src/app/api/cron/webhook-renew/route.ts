import { NextResponse } from 'next/server'
import { db, automations } from '@/db'
import { eq, and, sql } from 'drizzle-orm'

// Daily cron: re-subscribe all enabled YouTube pipelines to PubSubHubbub
// Vercel cron config in vercel.json:
// { "crons": [{ "path": "/api/cron/webhook-renew", "schedule": "0 8 * * *" }] }
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: Request) {
    // Basic cron secret check
    const secret = req.headers.get('x-cron-secret') || new URL(req.url).searchParams.get('secret')
    if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const youtubeAutomations = await db.query.automations.findMany({
        where: and(
            eq(automations.type, 'youtube'),
            eq(automations.enabled, true)
        ),
    })

    const results: { id: string; name: string; channelId: string; status: string }[] = []

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://canopticon.com'

    for (const auto of youtubeAutomations) {
        const config = auto.config as Record<string, unknown>
        const channelId = config.channelId as string
        if (!channelId) continue

        try {
            const res = await fetch(`${baseUrl}/api/webhooks/youtube/subscribe?channelId=${channelId}`)
            results.push({
                id: auto.id,
                name: auto.name,
                channelId,
                status: res.ok ? 'renewed' : `failed (${res.status})`,
            })
        } catch (e: any) {
            results.push({ id: auto.id, name: auto.name, channelId, status: `error: ${e.message}` })
        }
    }

    console.log('[webhook-renew] Results:', results)
    return NextResponse.json({ renewed: results.length, results })
}
