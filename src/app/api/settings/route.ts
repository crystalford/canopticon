
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
        // Mask sensitive keys if they exist
        const maskKeys = ['OPENAI_API_KEY', 'PERPLEXITY_API_KEY', 'TWITTER_API_KEY', 'TWITTER_API_SECRET', 'TWITTER_ACCESS_TOKEN', 'TWITTER_ACCESS_SECRET']
        for (const k of maskKeys) {
            if (safeConfig[k]) safeConfig[k] = '********'
        }

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
            // Skip masked placeholder values — never overwrite real DB values with '********'
            if (typeof value === 'string' && value !== '********' && value.trim() !== '') {
                updates.push(
                    db.insert(settings)
                        .values({ key, value: value.trim() })
                        .onConflictDoUpdate({ target: settings.key, set: { value: value.trim(), updatedAt: new Date() } })
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
