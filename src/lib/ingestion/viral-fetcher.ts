import { BskyAgent } from '@atproto/api'
import { db } from '@/db'
import { socialAccounts } from '@/db/schema'
import { eq } from 'drizzle-orm'

// Search keywords for Canadian context
const CANADIAN_QUERY = '("Canada" OR "Trudeau" OR "Poilievre" OR "#cdnpoli" OR "Canadian Politics")'

export type ViralPost = {
    platform: 'bluesky' | 'mastodon'
    uri: string
    cid: string // or id for mastodon
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

async function getAuthenticatedAgent() {
    try {
        // Try to find a stored Bluesky account
        const account = await db.query.socialAccounts.findFirst({
            where: eq(socialAccounts.platform, 'bluesky')
        })

        if (account && account.credentials) {
            const agent = new BskyAgent({ service: 'https://bsky.social' })
            const creds = account.credentials as any
            await agent.login({ identifier: creds.handle, password: creds.password })
            console.log('Using authenticated Bluesky agent for Viral Monitor')
            return agent
        }
    } catch (e) {
        console.warn('Failed to Create Authenticated Agent:', e)
    }

    // Fallback to public API
    console.log('Using public Bluesky API for Viral Monitor (Fallback)')
    return new BskyAgent({ service: 'https://public.api.bsky.app' })
}

async function fetchMastodonViral(limit = 10): Promise<ViralPost[]> {
    try {
        // Fetch from mastodon.social for #cdnpoli
        const res = await fetch(`https://mastodon.social/api/v1/timelines/tag/cdnpoli?limit=${limit}`)
        if (!res.ok) throw new Error('Mastodon fetch failed')
        const data = await res.json()

        return data.map((post: any) => ({
            platform: 'mastodon',
            uri: post.url,
            cid: post.id,
            author: {
                handle: `@${post.account.username}@mastodon.social`,
                displayName: post.account.display_name,
                avatar: post.account.avatar
            },
            content: post.content.replace(/<[^>]*>?/gm, ''), // Strip HTML
            metrics: {
                likes: post.favourites_count,
                reposts: post.reblogs_count,
                replies: post.replies_count
            },
            indexedAt: post.created_at
        }))
    } catch (e) {
        console.warn('Mastodon viral fetch failed', e)
        return []
    }
}

export async function fetchViralFeed(limit = 25): Promise<ViralPost[]> {
    console.log('Fetching Viral Feed...')

    const posts: ViralPost[] = []

    // 1. Fetch Bluesky
    try {
        const agent = await getAuthenticatedAgent()
        console.log(`Fetching Bluesky with query: ${CANADIAN_QUERY}`)
        const res = await agent.app.bsky.feed.searchPosts({
            q: CANADIAN_QUERY,
            sort: 'top',
            limit: limit
        })

        if (res.success) {
            console.log(`Bluesky success: Found ${res.data.posts.length} posts`)
            posts.push(...res.data.posts.map(post => ({
                platform: 'bluesky' as const,
                uri: post.uri,
                cid: post.cid,
                author: {
                    handle: post.author.handle,
                    displayName: post.author.displayName || post.author.handle,
                    avatar: post.author.avatar
                },
                content: (post.record as any).text || '',
                metrics: {
                    likes: post.likeCount || 0,
                    reposts: post.repostCount || 0,
                    replies: post.replyCount || 0
                },
                indexedAt: (post.record as any).createdAt
            })))
        } else {
            console.error('Bluesky fetch failed (res.success is false)')
        }
    } catch (e) {
        console.error('Bluesky viral fetch error:', e)
    }

    // 2. Fetch Mastodon
    console.log('Fetching Mastodon...')
    const mastoPosts = await fetchMastodonViral(limit)
    console.log(`Mastodon found: ${mastoPosts.length} posts`)
    posts.push(...mastoPosts)

    // 3. Sort merged list by likes (simple heuristic for "viral")
    return posts.sort((a, b) => b.metrics.likes - a.metrics.likes)
}


