import { NextResponse } from 'next/server'
import { db, automations } from '@/db'
import { eq, desc } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const monitors = await db.query.automations.findMany({
            where: eq(automations.type, 'video_monitor'),
            orderBy: [desc(automations.createdAt)],
        })
        return NextResponse.json(monitors)
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { name, channelId, channelHandle, channelName, clipArticle, postX, xFormat, xTweetCount, postBluesky, postTiktok, postThreads } = body

        if (!name || !channelId) {
            return NextResponse.json({ error: 'name and channelId are required' }, { status: 400 })
        }

        const [monitor] = await db.insert(automations).values({
            name,
            type: 'video_monitor',
            enabled: true,
            autoPublish: false,
            config: {
                channelId,
                channelHandle: channelHandle || '',
                channelName: channelName || name,
                postX: postX ?? true,
                xFormat: xFormat ?? 'post',
                xTweetCount: xTweetCount ?? 1,
                clipArticle: clipArticle ?? true,
                postBluesky: postBluesky ?? false,
                postTiktok: postTiktok ?? false,
                postThreads: postThreads ?? false,
            },
            prompt: null,
        }).returning()

        // Subscribe to YouTube PubSubHubbub — real-time push when new videos are published
        // (async verify so it doesn't block the response; YouTube will GET our callback to verify)
        try {
            const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || `https://${process.env.VERCEL_URL}` || 'https://canopticon.com').replace(/\/$/, '')
            const form = new URLSearchParams()
            form.append('hub.callback', `${baseUrl}/api/webhooks/youtube`)
            form.append('hub.topic', `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`)
            form.append('hub.mode', 'subscribe')
            form.append('hub.verify', 'async')
            form.append('hub.lease_seconds', '864000')
            const subRes = await fetch('https://pubsubhubbub.appspot.com/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: form,
            })
            console.log(`[video-monitors] PubSubHubbub subscription for ${channelId}: HTTP ${subRes.status}`)
        } catch (e: any) {
            console.warn(`[video-monitors] PubSubHubbub subscribe failed (non-fatal): ${e.message}`)
        }

        return NextResponse.json(monitor, { status: 201 })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
