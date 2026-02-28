import { BskyAgent, RichText } from '@atproto/api'

export async function postToBluesky({
    text,
    videoBuffer,
}: {
    text: string
    videoBuffer?: Buffer
}): Promise<string> {
    const handle = process.env.BLUESKY_HANDLE
    const password = process.env.BLUESKY_APP_PASSWORD
    if (!handle || !password) {
        throw new Error('Bluesky credentials not configured (BLUESKY_HANDLE + BLUESKY_APP_PASSWORD)')
    }

    const agent = new BskyAgent({ service: 'https://bsky.social' })
    await agent.login({ identifier: handle, password })

    const rt = new RichText({ text })
    await rt.detectFacets(agent)

    let embed: any = undefined

    if (videoBuffer) {
        try {
            const { data: blobData } = await agent.uploadBlob(videoBuffer, { encoding: 'video/mp4' })
            embed = {
                $type: 'app.bsky.embed.video',
                video: blobData.blob,
                aspectRatio: { width: 16, height: 9 },
            }
            console.log('[postToBluesky] Video uploaded to Bluesky')
        } catch (e) {
            console.warn('[postToBluesky] Video upload failed, posting text only:', e)
        }
    }

    const response = await agent.post({
        text: rt.text,
        facets: rt.facets,
        embed,
    })

    return response.uri
}
