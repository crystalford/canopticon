/**
 * Social Media Fetcher
 * Handles public API requests for Bluesky and Reddit
 */

export type SocialPost = {
    platform: 'bluesky' | 'reddit' | 'unknown'
    author: string
    content: string
    publishedAt: Date
    originalUrl: string
    metadata: Record<string, any>
}

// ============================================================================
// BLUESKY
// ============================================================================

const BSKY_PUBLIC_API = 'https://public.api.bsky.app/xrpc'

async function resolveBeskyHandle(handle: string): Promise<string | null> {
    try {
        const res = await fetch(`${BSKY_PUBLIC_API}/com.atproto.identity.resolveHandle?handle=${handle}`)
        if (!res.ok) return null
        const data = await res.json()
        return data.did
    } catch (e) {
        console.error('Failed to resolve Bsky handle:', e)
        return null
    }
}

async function fetchBlueskyPost(url: string): Promise<SocialPost | null> {
    // URL format: https://bsky.app/profile/{handle}/post/{rkey}
    const match = url.match(/bsky\.app\/profile\/([^/]+)\/post\/([^/?]+)/)
    if (!match) return null

    const [, handle, rkey] = match
    let did = handle
    if (!handle.startsWith('did:')) {
        const resolved = await resolveBeskyHandle(handle)
        if (!resolved) throw new Error(`Could not resolve handle: ${handle}`)
        did = resolved
    }

    const atUri = `at://${did}/app.bsky.feed.post/${rkey}`
    const threadUrl = `${BSKY_PUBLIC_API}/app.bsky.feed.getPostThread?uri=${atUri}`

    const res = await fetch(threadUrl)
    if (!res.ok) throw new Error(`Failed to fetch Bsky thread: ${res.statusText}`)

    const data = await res.json()
    const post = data.thread.post

    if (!post) throw new Error('Post not found in thread data')

    return {
        platform: 'bluesky',
        author: post.author.handle || post.author.displayName,
        content: (post.record as any).text,
        publishedAt: new Date((post.record as any).createdAt),
        originalUrl: url,
        metadata: {
            likes: post.likeCount,
            reposts: post.repostCount,
            replies: post.replyCount,
            did: post.author.did
        }
    }
}

// ============================================================================
// REDDIT
// ============================================================================

async function fetchRedditPost(url: string): Promise<SocialPost | null> {
    // Ensure URL matches standard reddit thread
    if (!url.includes('reddit.com/r/')) return null

    // Clean URL and add .json
    const jsonUrl = url.split('?')[0].replace(/\/$/, '') + '.json'

    const res = await fetch(jsonUrl, {
        headers: {
            'User-Agent': 'Canopticon-Research-Bot/1.0'
        }
    })

    if (!res.ok) throw new Error(`Failed to fetch Reddit thread: ${res.statusText}`)

    const data = await res.json()
    // Reddit returns array [0]: listing with the post, [1]: listing with comments
    const mainPost = data[0]?.data?.children?.[0]?.data

    if (!mainPost) throw new Error('No post data found')

    return {
        platform: 'reddit',
        author: mainPost.author,
        content: `${mainPost.title}\n\n${mainPost.selftext}`,
        publishedAt: new Date(mainPost.created_utc * 1000),
        originalUrl: url,
        metadata: {
            subreddit: mainPost.subreddit,
            ups: mainPost.ups,
            comments: mainPost.num_comments
        }
    }
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

export async function fetchSocialPost(url: string): Promise<SocialPost | null> {
    try {
        if (url.includes('bsky.app')) {
            return await fetchBlueskyPost(url)
        } else if (url.includes('reddit.com')) {
            return await fetchRedditPost(url)
        }
        return null
    } catch (error) {
        console.error('Social fetch failed:', error)
        return null
    }
}
