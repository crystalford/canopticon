import { NextResponse } from 'next/server'
import { db, automations } from '@/db'
import { eq } from 'drizzle-orm'
import { runAutomation } from '@/lib/automations/runner'

export const maxDuration = 60

export async function GET(req: Request) {
    // Verify the request is from Vercel Cron (or allow in dev)
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[cron] Running automation check...')

    // Get all enabled automations
    const enabledAutomations = await db.query.automations.findMany({
        where: eq(automations.enabled, true),
    })

    console.log(`[cron] Found ${enabledAutomations.length} enabled automations`)

    const results = []

    for (const automation of enabledAutomations) {
        try {
            const result = await runAutomation(automation)
            results.push({ id: automation.id, name: automation.name, ...result })
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            results.push({ id: automation.id, name: automation.name, error: message })
        }
    }

    console.log('[cron] Completed. Results:', JSON.stringify(results.map(r => ({
        name: r.name,
        success: 'success' in r ? r.success : false,
        skipped: 'skipped' in r ? r.skipped : false,
    }))))

    return NextResponse.json({ ran: results.length, results })
}
