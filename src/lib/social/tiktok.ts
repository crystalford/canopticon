/**
 * TikTok Content Posting API
 * Requires: TIKTOK_CLIENT_KEY + TIKTOK_CLIENT_SECRET + TIKTOK_ACCESS_TOKEN
 * Apply for access at: https://developers.tiktok.com/
 */
export async function postToTiktok({
    title,
    videoBuffer,
}: {
    title: string
    videoBuffer: Buffer
}): Promise<string> {
    const accessToken = process.env.TIKTOK_ACCESS_TOKEN
    if (!accessToken) {
        throw new Error('TikTok not configured (TIKTOK_ACCESS_TOKEN required). Apply at developers.tiktok.com')
    }

    // TikTok Content Posting API — Phase 1: Initialize upload
    const initRes = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify({
            post_info: {
                title: title.substring(0, 150),
                privacy_level: 'PUBLIC_TO_EVERYONE',
                disable_duet: false,
                disable_comment: false,
                disable_stitch: false,
            },
            source_info: {
                source: 'FILE_UPLOAD',
                video_size: videoBuffer.byteLength,
                chunk_size: videoBuffer.byteLength,
                total_chunk_count: 1,
            },
        }),
    })

    if (!initRes.ok) {
        const err = await initRes.text()
        throw new Error(`TikTok upload init failed: ${err}`)
    }

    const { data } = await initRes.json()
    const uploadUrl = data.upload_url
    const publishId = data.publish_id

    // Phase 2: Upload video bytes
    const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
            'Content-Type': 'video/mp4',
            'Content-Range': `bytes 0-${videoBuffer.byteLength - 1}/${videoBuffer.byteLength}`,
        },
        body: new Uint8Array(videoBuffer),
    })
    if (!uploadRes.ok) throw new Error(`TikTok video upload failed: ${uploadRes.status}`)

    console.log(`[postToTiktok] Published with id: ${publishId}`)
    return publishId
}
