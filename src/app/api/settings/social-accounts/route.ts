import { NextResponse } from 'next/server'
import { db } from '@/db'
import { socialAccounts } from '@/db/schema'
import { BlueskyPoster } from '@/lib/distribution/bluesky-poster'
import { MastodonPoster } from '@/lib/distribution/mastodon-poster'

export async function GET() {
    try {
        const accounts = await db.select().from(socialAccounts)

        // Return safe version of accounts (no credentials)
        const safeAccounts = accounts.map(acc => ({
            id: acc.id,
            platform: acc.platform,
            handle: acc.handle,
            instanceUrl: acc.instanceUrl,
            isActive: acc.isActive,
            createdAt: acc.createdAt
        }))

        return NextResponse.json(safeAccounts)
    } catch (e) {
        console.error('Failed to fetch social accounts', e)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { platform, credentials } = body

        if (!platform || !credentials) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        let handle = ''
        let instanceUrl = undefined

        // verify credentials
        if (platform === 'bluesky') {
            const poster = new BlueskyPoster()
            try {
                await poster.login({
                    handle: credentials.handle,
                    password: credentials.password // App Password
                })
                handle = credentials.handle
            } catch (e) {
                return NextResponse.json({ error: 'Invalid Bluesky credentials' }, { status: 401 })
            }
        } else if (platform === 'mastodon') {
            const poster = new MastodonPoster({
                instanceUrl: credentials.instanceUrl,
                accessToken: credentials.accessToken
            })
            const profile = await poster.verifyCredentials()
            if (!profile) {
                return NextResponse.json({ error: 'Invalid Mastodon credentials' }, { status: 401 })
            }
            handle = `@${profile.username}` // Store broadly as @user, UI can show full handle
            instanceUrl = credentials.instanceUrl
        } else {
            return NextResponse.json({ error: 'Unsupported platform' }, { status: 400 })
        }

        // Store in DB
        const [newAccount] = await db.insert(socialAccounts).values({
            platform,
            handle,
            instanceUrl,
            credentials, // Storing raw JSON for now (MVP)
            isActive: true
        }).returning()

        return NextResponse.json(newAccount)

    } catch (e) {
        console.error('Failed to create social account', e)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
