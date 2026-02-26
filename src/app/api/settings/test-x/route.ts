import { NextResponse } from 'next/server'
import { TwitterApi } from 'twitter-api-v2'
import { db } from '@/db'
import { settings } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth'

async function getCredential(key: string): Promise<string | undefined> {
    try {
        const row = await db.query.settings.findFirst({ where: eq(settings.key, key) })
        if (row?.value) return row.value
    } catch { /* settings table not ready */ }
    return process.env[key]
}

export async function POST(req: Request) {
    const authError = await requireAuth(req)
    if (authError) return authError

    const apiKey = await getCredential('TWITTER_API_KEY')
    const apiSecret = await getCredential('TWITTER_API_SECRET')
    const accessToken = await getCredential('TWITTER_ACCESS_TOKEN')
    const accessSecret = await getCredential('TWITTER_ACCESS_SECRET')

    if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
        return NextResponse.json({
            ok: false,
            message: 'Missing credentials — TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, and TWITTER_ACCESS_SECRET are all required'
        })
    }

    try {
        const client = new TwitterApi({ appKey: apiKey, appSecret: apiSecret, accessToken, accessSecret })
        const me = await client.v2.me()
        return NextResponse.json({
            ok: true,
            message: `Connected as @${me.data.username}`
        })
    } catch (e: any) {
        return NextResponse.json({
            ok: false,
            message: e.message || 'Twitter API error'
        })
    }
}
