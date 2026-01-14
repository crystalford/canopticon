
import { NextRequest, NextResponse } from 'next/server'
import { getSetting, setSetting, SETTINGS_KEYS } from '@/lib/db-settings'

export async function GET() {
    try {
        const provider = await getSetting(SETTINGS_KEYS.AI_PROVIDER) || 'openai'
        const hasOpenAI = !!(await getSetting(SETTINGS_KEYS.OPENAI_API_KEY))
        const hasAnthropic = !!(await getSetting(SETTINGS_KEYS.ANTHROPIC_API_KEY))
        const hasGrok = !!(await getSetting(SETTINGS_KEYS.GROK_API_KEY))

        return NextResponse.json({
            provider,
            status: {
                openai: hasOpenAI,
                anthropic: hasAnthropic,
                grok: hasGrok
            }
        })
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { provider, openai_key, anthropic_key, grok_key } = body

        if (provider) await setSetting(SETTINGS_KEYS.AI_PROVIDER, provider)
        if (openai_key) await setSetting(SETTINGS_KEYS.OPENAI_API_KEY, openai_key)
        if (anthropic_key) await setSetting(SETTINGS_KEYS.ANTHROPIC_API_KEY, anthropic_key)
        if (grok_key) await setSetting(SETTINGS_KEYS.GROK_API_KEY, grok_key)

        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
    }
}
