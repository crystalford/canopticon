import { BskyAgent } from '@atproto/api'

// Known Feed URIs
// This is the official "Discover" feed generator
const DISCOVER_FEED_URI = 'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/with-friends'

// Or "What's Hot" (Classic) - often used for global trending
const WHATS_HOT_FEED_URI = 'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot'

export type ViralPost = {
    uri: string
    cid: string
    author: {
        handle: string
        displayName: string
        avatar?: string
    }
    content: string
    metrics: {
        likes: number
        reposts: number
        replies: number
    }
    indexedAt: string
}

export async function fetchViralFeed(limit = 20): Promise<ViralPost[]> {
    // We can use a public agent without login for some public feeds, 
    // but often algorithmic feeds require an authenticated user context to personalize.
    // However, "What's Hot" is often global. 
    // Let's try to fetch it anonymously first.

    // Note: To fetch a custom feed generator, we usually need the 'app.bsky.feed.getFeed' method.
    // This often requires authentication.

    const agent = new BskyAgent({ service: 'https://public.api.bsky.app' })

    try {
        // Try fetching without login first. 
        // If this fails, we might need to ask the user for a "Public Service" login 
        // or just use the public 'getPostThread' via the other method if we had IDs.
        // But for *Discovery*, we need the feed.

        // Let's try creating a session-less request.
        // Usually algorithmic feeds need a user. If this fails, we'll return an empty list 
        // effectively prompting the UI to ask for credentials.

        const res = await agent.app.bsky.feed.getFeed({
            feed: WHATS_HOT_FEED_URI,
            limit: limit
        })

        if (!res.success) throw new Error('Failed to fetch feed')

        return res.data.feed.map(item => ({
            uri: item.post.uri,
            cid: item.post.cid,
            author: {
                handle: item.post.author.handle,
                displayName: item.post.author.displayName || item.post.author.handle,
                avatar: item.post.author.avatar
            },
            content: (item.post.record as any).text || '',
            metrics: {
                likes: item.post.likeCount || 0,
                reposts: item.post.repostCount || 0,
                replies: item.post.replyCount || 0
            },
            indexedAt: (item.post.record as any).createdAt
        }))

    } catch (e) {
        console.warn('Viral fetch failed (Auth likely required):', e)
        return []
    }
}
