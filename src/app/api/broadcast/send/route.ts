import { NextRequest, NextResponse } from 'next/server'
import { BlueskyPoster, BroadcastPost } from '@/lib/distribution/bluesky-poster'
import { MastodonPoster, MastodonCredentials } from '@/lib/distribution/mastodon-poster'

import { db } from '@/db'
import { socialAccounts } from '@/db/schema'
import { inArray } from 'drizzle-orm'

export async function POST(req: NextRequest) {
    try {
        const { thread, credentials, mastodonCredentials, accountIds } = await req.json()

        if (!thread || !Array.isArray(thread)) {
            return NextResponse.json({ error: 'Invalid thread data' }, { status: 400 })
        }

        const results: any = {
            bluesky: { posted: false },
            mastodon: { posted: false },
            accounts: []
        }

        const errors: string[] = []

        // --- NEW: PERSISTENT ACCOUNTS ---
        if (accountIds && Array.isArray(accountIds) && accountIds.length > 0) {
            const accounts = await db.select().from(socialAccounts).where(inArray(socialAccounts.id, accountIds))

            for (const acc of accounts) {
                try {
                    const postsToPublish = thread.map((p: any) => ({ text: p.text }))
                    let link = ''

                    if (acc.platform === 'bluesky') {
                        const poster = new BlueskyPoster()
                        const creds = acc.credentials as any
                        await poster.login({ handle: creds.handle, password: creds.password })
                        const rootPost = await poster.postThread(postsToPublish)
                        link = `https://bsky.app/profile/${acc.handle}/post/${rootPost?.uri.split('/').pop()}`
                        results.bluesky.posted = true // Mark general success
                    } else if (acc.platform === 'mastodon') {
                        const creds = acc.credentials as any
                        const poster = new MastodonPoster({ instanceUrl: creds.instanceUrl, accessToken: creds.accessToken })
                        link = await poster.postThread(postsToPublish)
                        results.mastodon.posted = true
                    }

                    results.accounts.push({ id: acc.id, platform: acc.platform, success: true, link })

                } catch (e: any) {
                    console.error(`Post failed for ${acc.platform} (${acc.handle})`, e)
                    errors.push(`${acc.platform} (${acc.handle}): ${e.message}`)
                    results.accounts.push({ id: acc.id, platform: acc.platform, success: false, error: e.message })
                }
            }
        }

        // --- LEGACY / MANUAL MODE ---
        if (credentials && credentials.handle && credentials.password) {
            try {
                const poster = new BlueskyPoster()
                await poster.login(credentials)
                const postsToPublish = thread.map((p: any) => ({ text: p.text }))
                const rootPost = await poster.postThread(postsToPublish)
                results.bluesky = {
                    posted: true,
                    link: `https://bsky.app/profile/${credentials.handle}/post/${rootPost?.uri.split('/').pop()}`
                }
            } catch (e: any) {
                console.error('Bluesky Error:', e)
                errors.push(`Bluesky (Manual): ${e.message}`)
            }
        }

        if (mastodonCredentials && mastodonCredentials.instanceUrl && mastodonCredentials.accessToken) {
            try {
                const poster = new MastodonPoster(mastodonCredentials)
                const postsToPublish = thread.map((p: any) => ({ text: p.text }))
                const rootUrl = await poster.postThread(postsToPublish)
                results.mastodon = {
                    posted: true,
                    link: rootUrl
                }
            } catch (e: any) {
                console.error('Mastodon Error:', e)
                errors.push(`Mastodon (Manual): ${e.message}`)
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

