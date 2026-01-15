
import { NextRequest, NextResponse } from 'next/server'
import { db, subscribers, articles } from '@/db'
import { eq, and } from 'drizzle-orm'
import { sendArticleEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
    try {
        // Authenticate - for now assume session check happens or is implicit 
        // In a real endpoint we'd verify the user session here

        const { articleId } = await request.json()

        if (!articleId) {
            return NextResponse.json({ error: 'Article ID required' }, { status: 400 })
        }

        // 1. Fetch Article
        const [article] = await db
            .select()
            .from(articles)
            .where(eq(articles.id, articleId))
            .limit(1)

        if (!article) {
            return NextResponse.json({ error: 'Article not found' }, { status: 404 })
        }

        // 2. Fetch Active Subscribers
        const activeSubscribers = await db
            .select()
            .from(subscribers)
            .where(eq(subscribers.status, 'subscribed'))

        if (activeSubscribers.length === 0) {
            return NextResponse.json({ message: 'No active subscribers found' })
        }

        // 3. Send Emails (Batching would be better for scale, simple loop for now)
        let successCount = 0
        let failCount = 0

        // In a real production app, this should be offloaded to a queue (Inngest/bullmq)
        // For MVP, we'll try to process a small batch directly.
        // Resend has a rate limit, so be careful.

        const promises = activeSubscribers.map(sub =>
            sendArticleEmail(sub.email, {
                headline: article.headline,
                content: article.content as string, // Cast or process
                summary: article.summary
            })
                .then(() => successCount++)
                .catch((e) => {
                    console.error(`Failed to send to ${sub.email}`, e)
                    failCount++
                })
        )

        await Promise.allSettled(promises)

        return NextResponse.json({
            success: true,
            sent: successCount,
            failed: failCount
        })

    } catch (error) {
        console.error('Broadcast error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
