import { NextResponse } from 'next/server'
import { db, videoClips } from '@/db'
import { eq } from 'drizzle-orm'
import { TwitterApi } from 'twitter-api-v2'
import { getCredential } from '@/lib/social/credentials'
import { transcodeForTwitter } from '@/lib/social/cloudinary'
import { buildTweetThread } from '@/lib/social/twitter'

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
        if (clip.xPostId) return NextResponse.json({ error: 'Already posted to X', tweetId: clip.xPostId }, { status: 409 })

        const apiKey = await getCredential('TWITTER_API_KEY')
        const apiSecret = await getCredential('TWITTER_API_SECRET')
        const accessToken = await getCredential('TWITTER_ACCESS_TOKEN')
        const accessSecret = await getCredential('TWITTER_ACCESS_SECRET')

        if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
            return NextResponse.json({ error: 'X/Twitter credentials not configured — add them in Settings' }, { status: 400 })
        }

        const client = new TwitterApi({ appKey: apiKey, appSecret: apiSecret, accessToken, accessSecret })

        const thread = buildTweetThread({
            rtHook: clip.keyQuote,
            contextBlock: clip.tweetDraft,
            forensicLayer: clip.forensicLayer,
            speakerName: clip.speakerName,
            channelName: clip.channelName,
        })

        // Fetch and transcode the clip
        const videoRes = await fetch(clip.clipUrl)
        if (!videoRes.ok) throw new Error(`Failed to fetch clip from storage: ${videoRes.status}`)
        const contentType = videoRes.headers.get('content-type') || 'unknown'
        const rawBuffer = Buffer.from(await videoRes.arrayBuffer())
        console.log(`[post-x] Raw clip: ${(rawBuffer.byteLength / 1024 / 1024).toFixed(1)}MB, content-type: ${contentType}`)

        const twitterBuffer = await transcodeForTwitter(rawBuffer, '[post-x]')
        console.log(`[post-x] Uploading to Twitter: ${(twitterBuffer.byteLength / 1024 / 1024).toFixed(1)}MB`)

        const mediaId = await client.v1.uploadMedia(twitterBuffer, { mimeType: 'video/mp4' })
        console.log(`[post-x] Twitter media uploaded: ${mediaId}`)

        // Tweet 1: RT hook (with video)
        const tweet = await client.v2.tweet(thread[0], { media: { media_ids: [mediaId] } })
        await db.update(videoClips)
            .set({ xPostedAt: new Date(), xPostId: tweet.data.id })
            .where(eq(videoClips.id, params.id))
        console.log(`[post-x] ✓ Tweet 1 posted (${thread.length}-tweet thread)`)

        // Remaining thread tweets
        let replyToId = tweet.data.id
        for (const replyText of thread.slice(1)) {
            try {
                const reply = await client.v2.tweet(replyText, { reply: { in_reply_to_tweet_id: replyToId } })
                replyToId = reply.data.id
                console.log(`[post-x] ✓ Thread reply posted`)
            } catch (e: any) {
                console.warn(`[post-x] Thread reply failed (main tweet succeeded): ${e.message}`)
            }
        }

        // YouTube URL as reply after thread — not in thread (avoids link penalty)
        if (clip.youtubeUrl) {
            try {
                await client.v2.tweet(clip.youtubeUrl, { reply: { in_reply_to_tweet_id: replyToId } })
                console.log(`[post-x] ✓ URL reply posted`)
            } catch (e: any) {
                console.warn(`[post-x] URL reply failed: ${e.message}`)
            }
        }

        return NextResponse.json({ success: true, tweetId: tweet.data.id })
    } catch (e: any) {
        console.error('[post-x] Failed:', e.message)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
