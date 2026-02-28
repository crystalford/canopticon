import { NextResponse } from 'next/server'
import { db } from '@/db'
import { videoClips } from '@/db/schema'
import { desc, eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url)
        const automationId = searchParams.get('automationId')

        const results = await db
            .select()
            .from(videoClips)
            .where(automationId ? eq(videoClips.automationId, automationId) : undefined)
            .orderBy(desc(videoClips.createdAt))
            .limit(50)

        return NextResponse.json(results)
    } catch (e: any) {
        console.error('[/api/videos GET] Error:', e.message)
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
        console.error('[/api/videos POST] Error:', e)
        return NextResponse.json({
            error: e.message,
            details: e.stack
        }, { status: 500 })
    }
}
