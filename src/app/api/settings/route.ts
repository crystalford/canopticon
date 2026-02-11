
import { db } from '@/db'
import { settings } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        // Try to fetch settings from DB
        const allSettings = await db.select().from(settings)
        const config: Record<string, string> = {}
        allSettings.forEach(s => config[s.key] = s.value)

        // Return masked version for UI
        const safeConfig = { ...config }
        // Mask keys if they exist
        if (safeConfig.OPENAI_API_KEY) safeConfig.OPENAI_API_KEY = '********'
        if (safeConfig.PERPLEXITY_API_KEY) safeConfig.PERPLEXITY_API_KEY = '********'

        return NextResponse.json(safeConfig)
    } catch (error) {
        console.warn('Settings table not ready, returning defaults:', error)
        return NextResponse.json({})
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const updates: Promise<any>[] = []

        for (const [key, value] of Object.entries(body)) {
            if (typeof value === 'string') {
                updates.push(
                    db.insert(settings)
                        .values({ key, value })
                        .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } })
                )
            }
        }

        await Promise.all(updates)
        return NextResponse.json({ success: true })

    } catch (error) {
        console.error('Failed to save settings:', error)
        return NextResponse.json({ error: 'Database not ready' }, { status: 503 })
    }
}
