import { db } from '@/db'
import { trackedTweets, socialMonitors } from '@/db/schema'
import { desc, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        // Fetch tweets with their monitor details
        const tweets = await db.select({
            id: trackedTweets.id,
            tweetId: trackedTweets.tweetId,
            content: trackedTweets.content,
            authorHandle: trackedTweets.authorHandle,
            authorName: trackedTweets.authorName,
            url: trackedTweets.url,
            createdAt: trackedTweets.createdAt,
            analyzed: trackedTweets.analyzed,
            fallaciesDetected: trackedTweets.fallaciesDetected,
            replyStatus: trackedTweets.replyStatus,
            replyDraft: trackedTweets.replyDraft,
            monitor: {
                id: socialMonitors.id,
                accountHandle: socialMonitors.accountHandle,
                displayName: socialMonitors.displayName,
            }
        })
            .from(trackedTweets)
            .leftJoin(socialMonitors, eq(trackedTweets.monitorId, socialMonitors.id))
            .orderBy(desc(trackedTweets.createdAt))
            .limit(50)

        return NextResponse.json(tweets)
    } catch (error) {
        console.error('Failed to fetch tracked tweets:', error)
        return NextResponse.json({ error: 'Failed to fetch tweets' }, { status: 500 })
    }
}
