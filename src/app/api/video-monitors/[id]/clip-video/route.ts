import { NextResponse } from 'next/server'
import { queueVideoClip } from '@/lib/videos/pipeline'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: Request, { params }: { params: { id: string } }) {
    try {
        const { youtubeUrl, title } = await req.json()
        if (!youtubeUrl) return NextResponse.json({ error: 'youtubeUrl required' }, { status: 400 })

        const clipId = await queueVideoClip(youtubeUrl, title, params.id)
        return NextResponse.json({ success: true, clipId })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
