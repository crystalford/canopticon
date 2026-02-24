import { NextResponse } from 'next/server'
import { db, automations } from '@/db'
import { eq } from 'drizzle-orm'
import { processYouTubeVideo } from '@/lib/automations/runner'

export const maxDuration = 120

// Run the pipeline against a specific video (retroactive runner)
export async function POST(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const { title, link, pubDate, description } = await req.json()

        if (!title || !link) {
            return NextResponse.json({ error: 'title and link required' }, { status: 400 })
        }

        const automation = await db.query.automations.findFirst({
            where: eq(automations.id, params.id),
        })
        if (!automation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

        const result = await processYouTubeVideo({ title, link, pubDate, description: description || '' }, automation)
        return NextResponse.json(result)
    } catch (e: any) {
        console.error('[run-video] Error:', e)
        return NextResponse.json({ error: e.message || 'Failed' }, { status: 500 })
    }
}
