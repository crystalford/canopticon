/**
 * Meta Threads API
 * Requires: THREADS_ACCESS_TOKEN + THREADS_USER_ID
 * Apply at: https://developers.facebook.com/docs/threads
 */
export async function postToThreads({
    text,
    videoBuffer,
}: {
    text: string
    videoBuffer?: Buffer
}): Promise<string> {
    const accessToken = process.env.THREADS_ACCESS_TOKEN
    const userId = process.env.THREADS_USER_ID
    if (!accessToken || !userId) {
        throw new Error('Threads not configured (THREADS_ACCESS_TOKEN + THREADS_USER_ID required)')
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
