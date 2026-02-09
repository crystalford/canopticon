import { NextResponse } from 'next/server'
import { TwitterApi } from 'twitter-api-v2'

export async function POST(req: Request) {
    try {
        const { tweets } = await req.json()

        if (!tweets || !Array.isArray(tweets) || tweets.length === 0) {
            return NextResponse.json({ error: 'Invalid tweets array' }, { status: 400 })
        }

        const apiKey = process.env.TWITTER_API_KEY
        const apiSecret = process.env.TWITTER_API_SECRET
        const accessToken = process.env.TWITTER_ACCESS_TOKEN
        const accessSecret = process.env.TWITTER_ACCESS_SECRET

        if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
            return NextResponse.json({ error: 'Twitter credentials missing' }, { status: 500 })
        }

        // Validate lengths
        const tooLong = tweets.findIndex((t: string) => t.length > 280)
        if (tooLong >= 0) {
            return NextResponse.json({
                error: `Tweet ${tooLong + 1} exceeds 280 characters (${tweets[tooLong].length})`
            }, { status: 400 })
        }

        const client = new TwitterApi({
            appKey: apiKey,
            appSecret: apiSecret,
            accessToken,
            accessSecret,
        })

        // Post thread
        let lastTweetId: string | undefined
        const postedTweets: { id: string; text: string }[] = []

        for (const text of tweets) {
            const params: any = { text }
            if (lastTweetId) {
                params.reply = { in_reply_to_tweet_id: lastTweetId }
            }

            const result = await client.v2.tweet(params)
            lastTweetId = result.data.id
            postedTweets.push({ id: result.data.id, text })
        }

        return NextResponse.json({
            success: true,
            threadUrl: `https://x.com/i/status/${postedTweets[0].id}`,
            tweetCount: postedTweets.length
        })

    } catch (error: any) {
        console.error('Failed to post thread:', error)
        return NextResponse.json({ error: error.message || 'Failed to post thread' }, { status: 500 })
    }
}
