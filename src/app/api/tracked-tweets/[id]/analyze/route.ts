import { db } from '@/db'
import { trackedTweets } from '@/db/schema'
import { detectFallacies } from '@/lib/ai/fallacy-detector'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export async function POST(req: Request, { params }: { params: { id: string } }) {
    try {
        const id = params.id
        const tweet = await db.query.trackedTweets.findFirst({
            where: eq(trackedTweets.id, id)
        })

        if (!tweet) {
            return NextResponse.json({ error: 'Tweet not found' }, { status: 404 })
        }

        const fallacies = await detectFallacies(tweet.content)

        await db.update(trackedTweets)
            .set({
                analyzed: true,
                fallaciesDetected: fallacies,
                analyzedAt: new Date(),
            })
            .where(eq(trackedTweets.id, id))

        return NextResponse.json({ success: true, fallacies })
    } catch (error) {
        console.error('Analysis failed:', error)
        return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
    }
}
