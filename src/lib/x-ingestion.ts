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

    // 30 minutes ago (Viral Scout mode - strict recency)
    const startTime = new Date(Date.now() - 30 * 60 * 1000).toISOString()

    for (const monitor of monitors) {
        // Rate limit / Cost check: skip if checked < 60 mins ago
        if (!force) {
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
            if (monitor.lastCheckedAt && monitor.lastCheckedAt > oneHourAgo) {
                continue
            }
        }

        try {
            let fetchedTweets: any[] = []

            // A) Keyword / Topic Scout (Search API)
            if (monitor.monitorType === 'keyword') {
                // ... (existing keyword logic) ...
                let query = monitor.accountHandle
                if (!query.includes('-is:retweet')) query += ' -is:retweet'
                if (!query.includes('-is:reply')) query += ' -is:reply'

                const searchRes = await readOnlyClient.v2.search(query, {
                    max_results: 10, // Limit to save costs
                    "tweet.fields": ["created_at", "text", "author_id", "public_metrics"],
                    start_time: startTime,
                    sort_order: 'recency'
                })
                fetchedTweets = searchRes.data.data || []
            }
            // B) Trending Scout (Canada Trends)
            else if (monitor.monitorType === 'trending') {
                // 1. Fetch Canada Trends (WOEID: 23424775)
                try {
                    // Use user client (client) instead of readOnlyClient for v1.1 just in case
                    const trendsResult = await client.v1.trendsByPlace(23424775)

                    if (!trendsResult || !trendsResult[0] || !trendsResult[0].trends) {
                        throw new Error('No trends data returned from X API')
                    }

                    const topTrends = trendsResult[0].trends.slice(0, 3) // Top 3 trends only to save search quota

                    // 2. Scout top tweet for each trend
                    for (const trend of topTrends) {
                        const query = `"${trend.name}" -is:retweet -is:reply lang:en`
                        const searchRes = await readOnlyClient.v2.search(query, {
                            max_results: 10, // Get a few to pick best? Or just 1? Let's get 5.
                            "tweet.fields": ["created_at", "text", "author_id", "public_metrics"],
                            start_time: startTime,
                            sort_order: 'relevancy' // Use relevancy for trends to get the "definitive" tweet
                        })
                        if (searchRes.data.data) {
                            fetchedTweets.push(...searchRes.data.data)
                        }
                    }
                } catch (err) {
                    console.error('Failed to fetch trends:', err)
                }
            }
            // C) Account Monitor (User Timeline)
            else {
                // Determine since_id from latest tracked tweet to avoid duplicates (if newer than 24h)
                const latestTweet = await db.query.trackedTweets.findFirst({
                    where: eq(trackedTweets.monitorId, monitor.id),
                    orderBy: [desc(trackedTweets.tweetId)],
                })

                // Only use since_id if we have one, otherwise rely on start_time
                const options: any = {
                    max_results: 10,
                    exclude: ['retweets', 'replies'],
                    "tweet.fields": ["created_at", "text", "author_id", "public_metrics"],
                    start_time: startTime
                }

                if (latestTweet?.tweetId) {
                    options.since_id = latestTweet.tweetId
                    // X API: cannot use both since_id and start_time effectively sometimes, 
                    // but usually since_id takes precedence. We send start_time as safeguard if since_id is invalid/old.
                    // Actually, if we provide since_id, start_time might be ignored or conflict. 
                    // Let's use start_time strictly to ensure we don't go back 5 years even if DB is empty.
                    // If DB has latest tweet, we use that.
                    delete options.start_time
                }

                const timeline = await readOnlyClient.v2.userTimeline(
                    monitor.accountId || await getAccountId(readOnlyClient, monitor.accountHandle),
                    options
                )
                fetchedTweets = timeline.data.data || []
            }

            let addedCount = 0

            for (const tweet of fetchedTweets) {
                const existing = await db.query.trackedTweets.findFirst({
                    where: eq(trackedTweets.tweetId, tweet.id)
                })

                if (!existing) {
                    // For keywords, we might not have author handle easily resolved without extra calls/expansions.
                    // Search API returns author_id. We'd strictly need to expand author_id to get handle.
                    // For now, we'll store author_id as handle fallback or "Unknown" to save calls.
                    // Optimization: We can request expansions=['author_id'] in search.

                    let authorHandle = tweet.author_id ? `uid:${tweet.author_id}` : 'Unknown'
                    // If it's an account monitor, we know the handle
                    if (monitor.monitorType !== 'keyword') {
                        authorHandle = monitor.accountHandle
                    }

                    await db.insert(trackedTweets).values({
                        tweetId: tweet.id,
                        monitorId: monitor.id,
                        authorHandle: authorHandle,
                        authorName: monitor.monitorType === 'keyword' ? 'Topic Scout' : monitor.displayName,
                        content: tweet.text,
                        url: `https://twitter.com/x/status/${tweet.id}`,
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

            results.push({ handle: monitor.accountHandle, new: addedCount, type: monitor.monitorType })

        } catch (err: any) {
            console.error(`Error processing ${monitor.accountHandle}:`, err)
            results.push({ handle: monitor.accountHandle, error: err.message })
        }
    }

    return results
}

// Helper to get ID from handle if missing
async function getAccountId(client: any, handle: string): Promise<string> {
    // If it's a keyword monitor, we don't need an account ID
    if (!handle.startsWith('@')) return '0'

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
