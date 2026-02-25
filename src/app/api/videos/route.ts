import { NextResponse } from 'next/server'
import { db } from '@/db'
import { videoClips } from '@/db/schema'
import { desc } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const results = await db.query.videoClips.findMany({
            orderBy: [desc(videoClips.createdAt)],
            limit: 50
        })
        return NextResponse.json(results)
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const { youtubeUrl } = await req.json()
        if (!youtubeUrl) return NextResponse.json({ error: 'youtubeUrl required' }, { status: 400 })

        const [clip] = await db.insert(videoClips).values({
            youtubeUrl,
            status: 'queued'
        }).returning()

        return NextResponse.json(clip, { status: 201 })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
