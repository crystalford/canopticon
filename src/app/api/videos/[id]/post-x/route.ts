import { NextResponse } from 'next/server'
import { db, videoClips } from '@/db'
import { eq } from 'drizzle-orm'
import { TwitterApi } from 'twitter-api-v2'
import { getCredential } from '@/lib/social/credentials'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Transcode video to Twitter-compatible format (H.264 + AAC + faststart MP4)
 * using Cloudinary's free tier. If Cloudinary env vars are not set, returns
 * the original buffer unchanged (upload will succeed if Apify already output H.264).
 */
async function transcodeForTwitter(buffer: Buffer): Promise<Buffer> {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME
    const apiKey = process.env.CLOUDINARY_API_KEY
    const apiSecret = process.env.CLOUDINARY_API_SECRET
    if (!cloudName || !apiKey || !apiSecret) {
        console.log('[post-x] Cloudinary not configured — uploading raw video as-is (add CLOUDINARY_* env vars if Twitter rejects it)')
        return buffer
    }

    // Twitter requires: H.264 baseline, AAC audio, yuv420p, faststart (moov atom first)
    const eager = 'vc_h264:baseline:3.1,ac_aac,f_mp4,fl_faststart'
    const timestamp = Math.floor(Date.now() / 1000)
    const signature = crypto.createHash('sha1')
        .update(`eager=${eager}&timestamp=${timestamp}${apiSecret}`)
        .digest('hex')

    const form = new FormData()
    form.append('file', new Blob([new Uint8Array(buffer)], { type: 'video/mp4' }))
    form.append('api_key', apiKey)
    form.append('timestamp', String(timestamp))
    form.append('signature', signature)
    form.append('eager', eager)
    form.append('eager_async', 'false') // wait for transform before returning

    console.log(`[post-x] Uploading ${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB to Cloudinary for transcoding...`)
    const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/video/upload`, {
        method: 'POST',
        body: form,
    })
    if (!uploadRes.ok) throw new Error(`Cloudinary upload failed: ${await uploadRes.text()}`)

    const data = await uploadRes.json()
    const transformedUrl = data.eager?.[0]?.secure_url
    if (!transformedUrl) throw new Error(`Cloudinary transformation failed: ${JSON.stringify(data)}`)

    console.log(`[post-x] Cloudinary transcoded: ${transformedUrl}`)
    const transcoded = await fetch(transformedUrl)
    if (!transcoded.ok) throw new Error('Failed to download transcoded video from Cloudinary')

    return Buffer.from(await transcoded.arrayBuffer())
}

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
        const twitterBuffer = await transcodeForTwitter(rawBuffer)
        console.log(`[post-x] Uploading to Twitter: ${(twitterBuffer.byteLength / 1024 / 1024).toFixed(1)}MB`)

        // Upload to Twitter
        const mediaId = await client.v1.uploadMedia(twitterBuffer, { mimeType: 'video/mp4' })
        console.log(`[post-x] Twitter media uploaded: ${mediaId}`)

        const tweet = await client.v2.tweet(tweetText, { media: { media_ids: [mediaId] } })

        await db.update(videoClips)
            .set({ xPostedAt: new Date(), xPostId: tweet.data.id })
            .where(eq(videoClips.id, params.id))

        return NextResponse.json({ success: true, tweetId: tweet.data.id })
    } catch (e: any) {
        console.error('[post-x] Failed:', e.message)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
