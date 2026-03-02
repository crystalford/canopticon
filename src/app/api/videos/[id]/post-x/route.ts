import { NextResponse } from 'next/server'
import { db, videoClips } from '@/db'
import { eq } from 'drizzle-orm'
import { TwitterApi } from 'twitter-api-v2'
import { getCredential } from '@/lib/social/credentials'
import { transcodeForTwitter } from '@/lib/social/cloudinary'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(
    _req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const [clip] = await db.select().from(videoClips).where(eq(videoClips.id, params.id)).limit(1)
        if (!clip) return NextResponse.json({ error: 'Clip not found' }, { status: 404 })
        if (!clip.clipUrl) return NextResponse.json({ error: 'Clip has no URL yet' }, { status: 400 })

        const apiKey = await getCredential('TWITTER_API_KEY')
        const apiSecret = await getCredential('TWITTER_API_SECRET')
        const accessToken = await getCredential('TWITTER_ACCESS_TOKEN')
        const accessSecret = await getCredential('TWITTER_ACCESS_SECRET')

        if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
            return NextResponse.json({ error: 'X/Twitter credentials not configured — add them in Settings' }, { status: 400 })
        }

        const client = new TwitterApi({ appKey: apiKey, appSecret: apiSecret, accessToken, accessSecret })

        const tweetText = clip.tweetDraft || (clip.keyQuote
            ? `"${clip.keyQuote}"\n\n— ${clip.channelName || clip.videoTitle || 'Source'}`
            : clip.videoTitle || 'New clip')

        // Fetch the raw clip
        const videoRes = await fetch(clip.clipUrl)
        if (!videoRes.ok) throw new Error(`Failed to fetch clip from storage: ${videoRes.status}`)
        const contentType = videoRes.headers.get('content-type') || 'unknown'
        const rawBuffer = Buffer.from(await videoRes.arrayBuffer())
        console.log(`[post-x] Raw clip: ${(rawBuffer.byteLength / 1024 / 1024).toFixed(1)}MB, content-type: ${contentType}`)

        // Transcode to Twitter-compatible format via Cloudinary (if configured), else try raw
        const twitterBuffer = await transcodeForTwitter(rawBuffer, '[post-x]')
        console.log(`[post-x] Uploading to Twitter: ${(twitterBuffer.byteLength / 1024 / 1024).toFixed(1)}MB`)

        // Upload to Twitter
        const mediaId = await client.v1.uploadMedia(twitterBuffer, { mimeType: 'video/mp4' })
        console.log(`[post-x] Twitter media uploaded: ${mediaId}`)

        const tweet = await client.v2.tweet(tweetText, { media: { media_ids: [mediaId] } })

        await db.update(videoClips)
            .set({ xPostedAt: new Date(), xPostId: tweet.data.id })
            .where(eq(videoClips.id, params.id))

        // Thread reply: source label first, then URL (X embeds the video below)
        try {
            const sourceName = clip.channelName || clip.videoTitle || 'Source'
            const sourceReply = `Source: ${sourceName}\n\n${clip.youtubeUrl}`
            await client.v2.tweet(sourceReply, { reply: { in_reply_to_tweet_id: tweet.data.id } })
            console.log(`[post-x] ✓ Posted source thread reply`)
        } catch (e: any) {
            console.warn(`[post-x] Thread reply failed (main tweet succeeded): ${e.message}`)
        }

        return NextResponse.json({ success: true, tweetId: tweet.data.id })
    } catch (e: any) {
        console.error('[post-x] Failed:', e.message)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
