import crypto from 'crypto'

/**
 * Transcode video to Twitter-compatible format (H.264 baseline + AAC + faststart MP4)
 * using Cloudinary. If CLOUDINARY_* env vars are not set, returns the original buffer
 * unchanged (upload will succeed if Apify already outputs compliant H.264).
 */
export async function transcodeForTwitter(buffer: Buffer, logPrefix = '[cloudinary]'): Promise<Buffer> {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME
    const apiKey = process.env.CLOUDINARY_API_KEY
    const apiSecret = process.env.CLOUDINARY_API_SECRET
    if (!cloudName || !apiKey || !apiSecret) {
        console.log(`${logPrefix} Cloudinary not configured — uploading raw video as-is`)
        return buffer
    }

    // Twitter requires: H.264 baseline, AAC audio, MP4 container
    // Cloudinary MP4 delivery is already moov-first (faststart) — fl_faststart is not a valid Cloudinary flag
    const eager = 'vc_h264:baseline:3.1,ac_aac,f_mp4'
    const timestamp = Math.floor(Date.now() / 1000)
    const signature = crypto.createHash('sha1')
        .update(`eager=${eager}&eager_async=false&timestamp=${timestamp}${apiSecret}`)
        .digest('hex')

    const form = new FormData()
    form.append('file', new Blob([new Uint8Array(buffer)], { type: 'video/mp4' }))
    form.append('api_key', apiKey)
    form.append('timestamp', String(timestamp))
    form.append('signature', signature)
    form.append('eager', eager)
    form.append('eager_async', 'false') // wait for transform before returning

    console.log(`${logPrefix} Uploading ${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB to Cloudinary for transcoding...`)
    const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/video/upload`, {
        method: 'POST',
        body: form,
    })
    if (!uploadRes.ok) throw new Error(`Cloudinary upload failed: ${await uploadRes.text()}`)

    const data = await uploadRes.json()
    const transformedUrl = data.eager?.[0]?.secure_url
    if (!transformedUrl) throw new Error(`Cloudinary transformation failed: ${JSON.stringify(data)}`)

    console.log(`${logPrefix} Cloudinary transcoded: ${transformedUrl}`)
    const transcoded = await fetch(transformedUrl)
    if (!transcoded.ok) throw new Error('Failed to download transcoded video from Cloudinary')

    return Buffer.from(await transcoded.arrayBuffer())
}
