export type MastodonCredentials = {
    instanceUrl: string // e.g., 'https://mastodon.social'
    accessToken: string
}

export type MastodonStatus = {
    status: string
    visiblity?: 'public' | 'unlisted' | 'private' | 'direct'
    in_reply_to_id?: string
}

export class MastodonPoster {
    private instanceUrl: string
    private accessToken: string

    constructor(creds: MastodonCredentials) {
        // Clean URL
        this.instanceUrl = creds.instanceUrl.replace(/\/$/, '')
        this.accessToken = creds.accessToken
    }

    private async postStatus(status: MastodonStatus) {
        const url = `${this.instanceUrl}/api/v1/statuses`

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json',
                // Idempotency key?
            },
            body: JSON.stringify(status)
        })

        if (!res.ok) {
            const errorText = await res.text()
            throw new Error(`Mastodon API Error (${res.status}): ${errorText}`)
        }

        return await res.json()
    }

    /**
     * Posts a threaded conversation
     */
    async postThread(posts: { text: string }[]): Promise<string> {
        if (posts.length === 0) throw new Error('No posts to send')

        let lastId: string | undefined = undefined
        let rootUrl: string = ''

        for (let i = 0; i < posts.length; i++) {
            const post = posts[i]

            const result = await this.postStatus({
                status: post.text,
                visiblity: 'public', // Default to public for broadcasts
                in_reply_to_id: lastId
            })

            lastId = result.id
            if (i === 0) {
                // Construct URL to the status (Note: API returns `url` field)
                rootUrl = result.url
            }
        }

        return rootUrl
    }
}
