import { NextRequest, NextResponse } from 'next/server'
import { BlueskyPoster, BroadcastPost } from '@/lib/distribution/bluesky-poster'

export async function POST(req: NextRequest) {
    try {
        const { thread, credentials } = await req.json()

        if (!thread || !Array.isArray(thread)) {
            return NextResponse.json({ error: 'Invalid thread data' }, { status: 400 })
        }

        if (!credentials || !credentials.handle || !credentials.password) {
            return NextResponse.json({ error: 'Missing Bluesky credentials' }, { status: 401 })
        }

        const poster = new BlueskyPoster()
        await poster.login(credentials)

        // Convert the simple thread format to the poster's format
        // (If we had image prompts, we would skip them or generate images here, 
        // but for MVP we assume text only + links)
        const postsToPublish: BroadcastPost[] = thread.map((p: any) => ({
            text: p.text
            // In a full version, we'd attach cards here
        }))

        const rootPost = await poster.postThread(postsToPublish)

        return NextResponse.json({
            success: true,
            uri: rootPost?.uri,
            link: `https://bsky.app/profile/${credentials.handle}/post/${rootPost?.uri.split('/').pop()}`
        })

    } catch (error: any) {
        console.error('Broadcast sending failed:', error)
        return NextResponse.json(
            { error: 'Failed to send broadcast', details: error.message },
            { status: 500 }
        )
    }
}
