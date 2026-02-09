import { TwitterApi } from 'twitter-api-v2'

export function getXClient() {
    const apiKey = process.env.TWITTER_API_KEY
    const apiSecret = process.env.TWITTER_API_SECRET
    const accessToken = process.env.TWITTER_ACCESS_TOKEN
    const accessSecret = process.env.TWITTER_ACCESS_SECRET

    if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
        throw new Error('X/Twitter API credentials not configured')
    }

    return new TwitterApi({
        appKey: apiKey,
        appSecret: apiSecret,
        accessToken: accessToken,
        accessSecret: accessSecret,
    })
}
