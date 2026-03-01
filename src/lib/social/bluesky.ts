import { AtpAgent, RichText } from '@atproto/api'
import { getCredential } from './credentials'

/**
 * Upload video to Bluesky's dedicated video service.
 * This is separate from uploadBlob (which is images only).
 * Returns the blob reference for use in the post embed, or null if upload/processing fails.
 */
async function uploadVideoToBluesky(agent: AtpAgent, videoBuffer: Buffer): Promise<any | null> {
    try {
        const session = (agent as any).session
        if (!session?.accessJwt || !session?.did) throw new Error('Not logged in')

        // Step 1: upload raw bytes to Bluesky's video service
        const uploadRes = await fetch(
            `https://video.bsky.app/xrpc/app.bsky.video.uploadVideo?did=${encodeURIComponent(session.did)}&name=clip.mp4`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.accessJwt}`,
                    'Content-Type': 'video/mp4',
                },
                body: new Uint8Array(videoBuffer),
            }
        )
        if (!uploadRes.ok) throw new Error(`Video service upload failed: ${await uploadRes.text()}`)
        const uploadData = await uploadRes.json()
        const jobId = uploadData.jobId
        if (!jobId) throw new Error(`No jobId returned: ${JSON.stringify(uploadData)}`)
        console.log(`[postToBluesky] Video upload job started: ${jobId}`)

        // Step 2: poll for processing completion (max 45 seconds)
        const deadline = Date.now() + 45_000
        while (Date.now() < deadline) {
            await new Promise(r => setTimeout(r, 3000))
            const statusRes = await fetch(
                `https://video.bsky.app/xrpc/app.bsky.video.getJobStatus?jobId=${encodeURIComponent(jobId)}`,
                { headers: { 'Authorization': `Bearer ${session.accessJwt}` } }
            )
            if (!statusRes.ok) continue
            const { jobStatus } = await statusRes.json()
            console.log(`[postToBluesky] Video job state: ${jobStatus?.state}`)
            if (jobStatus?.state === 'JOB_STATE_COMPLETED' && jobStatus.blob) {
                return jobStatus.blob
            }
            if (jobStatus?.state === 'JOB_STATE_FAILED') {
                throw new Error(`Bluesky video processing failed: ${jobStatus.error || 'unknown'}`)
            }
        }
        throw new Error('Bluesky video processing timed out after 45s')
    } catch (e: any) {
        console.warn(`[postToBluesky] Video upload failed: ${e.message}`)
        return null
    }
}

export async function postToBluesky({
    text,
    videoBuffer,
}: {
    text: string
    videoBuffer?: Buffer
}): Promise<string> {
    const handle = await getCredential('BLUESKY_HANDLE')
    const password = await getCredential('BLUESKY_APP_PASSWORD')
    if (!handle || !password) {
        throw new Error('Bluesky credentials not configured — add BLUESKY_HANDLE and BLUESKY_APP_PASSWORD in Settings')
    }

    const agent = new AtpAgent({ service: 'https://bsky.social' })
    await agent.login({ identifier: handle, password })

    const rt = new RichText({ text })
    await rt.detectFacets(agent)

    let embed: any = undefined

    if (videoBuffer) {
        const blob = await uploadVideoToBluesky(agent, videoBuffer)
        if (blob) {
            embed = {
                $type: 'app.bsky.embed.video',
                video: blob,
                aspectRatio: { width: 16, height: 9 },
            }
            console.log('[postToBluesky] Video embed ready')
        } else {
            console.warn('[postToBluesky] Posting text-only (video processing failed)')
        }
    }

    const response = await agent.post({
        text: rt.text,
        facets: rt.facets,
        embed,
    })

    return response.uri
}
