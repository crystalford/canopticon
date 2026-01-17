import { NextRequest, NextResponse } from 'next/server'
import { BlueskyPoster, BroadcastPost } from '@/lib/distribution/bluesky-poster'
import { MastodonPoster, MastodonCredentials } from '@/lib/distribution/mastodon-poster'

export async function POST(req: NextRequest) {
    try {
        const { thread, credentials, mastodonCredentials } = await req.json()

        if (!thread || !Array.isArray(thread)) {
            return NextResponse.json({ error: 'Invalid thread data' }, { status: 400 })
        }

        const results: any = {
            bluesky: { posted: false },
            mastodon: { posted: false }
        }

        const errors: string[] = []

        // --- BLUESKY POSTING ---
        if (credentials && credentials.handle && credentials.password) {
            try {
                const poster = new BlueskyPoster()
                await poster.login(credentials)

                const postsToPublish: BroadcastPost[] = thread.map((p: any) => ({
                    text: p.text
                }))

                const rootPost = await poster.postThread(postsToPublish)

                results.bluesky = {
                    posted: true,
                    link: `https://bsky.app/profile/${credentials.handle}/post/${rootPost?.uri.split('/').pop()}`
                }
            } catch (e: any) {
                console.error('Bluesky Error:', e)
                errors.push(`Bluesky: ${e.message}`)
            }
        }

        // --- MASTODON POSTING ---
        if (mastodonCredentials && mastodonCredentials.instanceUrl && mastodonCredentials.accessToken) {
            try {
                const poster = new MastodonPoster(mastodonCredentials)

                const postsToPublish = thread.map((p: any) => ({
                    text: p.text
                }))

                const rootUrl = await poster.postThread(postsToPublish)

                results.mastodon = {
                    posted: true,
                    link: rootUrl
                }
            } catch (e: any) {
                console.error('Mastodon Error:', e)
                errors.push(`Mastodon: ${e.message}`)
            }
        }

        if (errors.length > 0 && !results.bluesky.posted && !results.mastodon.posted) {
            return NextResponse.json({ error: 'All posts failed', details: errors }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            results,
            errors: errors.length > 0 ? errors : undefined
        })

    } catch (error: any) {
        console.error('Broadcast sending failed:', error)
        return NextResponse.json(
            { error: 'Failed to send broadcast', details: error.message },
            { status: 500 }
        )
    }
}

