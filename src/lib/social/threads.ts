import { getCredential } from './credentials'

/**
 * Meta Threads API
 * Requires: THREADS_ACCESS_TOKEN + THREADS_USER_ID — add in Settings or as env vars.
 * Apply at: https://developers.facebook.com/docs/threads
 */
export async function postToThreads({
    text,
}: {
    text: string
}): Promise<string> {
    const accessToken = await getCredential('THREADS_ACCESS_TOKEN')
    const userId = await getCredential('THREADS_USER_ID')
    if (!accessToken || !userId) {
        throw new Error('Threads not configured — add THREADS_ACCESS_TOKEN and THREADS_USER_ID in Settings')
    }

    // Step 1: Create media container
    const containerRes = await fetch(
        `https://graph.threads.net/v1.0/${userId}/threads`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                media_type: 'TEXT',
                text,
                access_token: accessToken,
            }),
        }
    )

    if (!containerRes.ok) {
        const err = await containerRes.text()
        throw new Error(`Threads container creation failed: ${err}`)
    }

    const { id: containerId } = await containerRes.json()

    // Step 2: Publish
    const publishRes = await fetch(
        `https://graph.threads.net/v1.0/${userId}/threads_publish`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                creation_id: containerId,
                access_token: accessToken,
            }),
        }
    )

    if (!publishRes.ok) {
        const err = await publishRes.text()
        throw new Error(`Threads publish failed: ${err}`)
    }

    const { id } = await publishRes.json()
    console.log(`[postToThreads] Published: ${id}`)
    return id
}
