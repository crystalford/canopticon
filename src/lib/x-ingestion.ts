import { db } from '@/db'
import { socialMonitors, trackedTweets } from '@/db/schema'
import { getXClient } from '@/lib/x-client'
import { eq, desc, and, lt } from 'drizzle-orm'

export async function ingestTweetsForMonitors(force = false) {
    const monitors = await db.select()
        .from(socialMonitors)
        .where(eq(socialMonitors.enabled, true))

    const results = []
    const client = getXClient()
    const readOnlyClient = client.readOnly

    for (const monitor of monitors) {
        // Rate limit / Cost check: skip if checked < 60 mins ago (Pay Per Use optimization)
        // UNLESS force is true (Manual Trigger)
        if (!force) {
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
            if (monitor.lastCheckedAt && monitor.lastCheckedAt > oneHourAgo) {
                continue
            }
        }

        try {
            // Determine since_id from latest tracked tweet for this monitor
            const latestTweet = await db.query.trackedTweets.findFirst({
                where: eq(trackedTweets.monitorId, monitor.id),
                orderBy: [desc(trackedTweets.tweetId)],
            })

            const sinceId = latestTweet?.tweetId

            // Fetch tweets
            const timeline = await readOnlyClient.v2.userTimeline(monitor.accountId || await getAccountId(readOnlyClient, monitor.accountHandle), {
                max_results: 10, // Keep it low for cost efficiency
                exclude: ['retweets', 'replies'], // Focus on original content
                since_id: sinceId,
                "tweet.fields": ["created_at", "text", "author_id"]
            })

            let addedCount = 0

            for (const tweet of timeline.data.data || []) {
                const existing = await db.query.trackedTweets.findFirst({
                    where: eq(trackedTweets.tweetId, tweet.id)
                })

                if (!existing) {
                    await db.insert(trackedTweets).values({
                        tweetId: tweet.id,
                        monitorId: monitor.id,
                        authorHandle: monitor.accountHandle,
                        authorName: monitor.displayName,
                        content: tweet.text,
                        url: `https://twitter.com/${monitor.accountHandle.replace('@', '')}/status/${tweet.id}`,
                        createdAt: new Date(tweet.created_at || Date.now()),
                        analyzed: false,
                    })
                    addedCount++
                }
            }

            // Update last checked
            await db.update(socialMonitors)
                .set({ lastCheckedAt: new Date() })
                .where(eq(socialMonitors.id, monitor.id))

            results.push({ handle: monitor.accountHandle, new: addedCount })

        } catch (err: any) {
            console.error(`Error processing ${monitor.accountHandle}:`, err)
            results.push({ handle: monitor.accountHandle, error: err.message })
        }
    }

    return results
}

// Helper to get ID from handle if missing
async function getAccountId(client: any, handle: string): Promise<string> {
    const user = await client.v2.userByUsername(handle.replace('@', ''))
    if (user.data) {
        const dbHandle = handle.startsWith('@') ? handle : `@${handle}`
        await db.update(socialMonitors)
            .set({ accountId: user.data.id })
            .where(eq(socialMonitors.accountHandle, dbHandle))
        return user.data.id
    }
    throw new Error(`User not found: ${handle}`)
}
