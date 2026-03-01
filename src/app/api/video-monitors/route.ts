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

        return NextResponse.json(monitor, { status: 201 })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
