import { NextResponse } from 'next/server'
import { queueVideoClip } from '@/lib/videos/pipeline'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: Request) {
    try {
        const { youtubeUrl } = await req.json()
        if (!youtubeUrl) return NextResponse.json({ error: 'youtubeUrl required' }, { status: 400 })

        const clipId = await queueVideoClip(youtubeUrl, 'Loading...')
        return NextResponse.json({ clipId }, { status: 201 })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
