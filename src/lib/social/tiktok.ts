import { getCredential } from './credentials'

/**
 * Post a video clip to TikTok via Ayrshare.
 * Ayrshare handles TikTok auth without requiring a TikTok developer account.
 * Setup: sign up at ayrshare.com, connect TikTok, add AYRSHARE_API_KEY to env/Settings.
 */
export async function postToTiktok({
    title,
    videoUrl,
}: {
    title: string
    videoUrl: string
}): Promise<string> {
    const apiKey = await getCredential('AYRSHARE_API_KEY')
    if (!apiKey) {
        throw new Error('TikTok not configured — add AYRSHARE_API_KEY in Settings (sign up at ayrshare.com, connect your TikTok account)')
    }

    const res = await fetch('https://app.ayrshare.com/api/post', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            post: title.substring(0, 2200),
            platforms: ['tiktok'],
            mediaUrls: [videoUrl],
        }),
    })

    if (!res.ok) throw new Error(`Ayrshare TikTok post failed: ${await res.text()}`)
    const data = await res.json()
    if (data.status === 'error') throw new Error(`Ayrshare error: ${data.message}`)

    const postId = data.postIds?.find((p: any) => p.platform === 'tiktok')?.id || data.id || 'posted'
    console.log(`[postToTiktok] ✓ Posted via Ayrshare: ${postId}`)
    return postId
}
