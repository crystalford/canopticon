
import { NextRequest, NextResponse } from 'next/server'
import { runPMOWorker } from '@/lib/ingestion/pmo-worker'
import { db, sources } from '@/db'
import { eq } from 'drizzle-orm'

export async function POST(request: NextRequest) {
    try {
        const { limit = 10 } = await request.json()

        // Get Source ID
        const [source] = await db
            .select()
            .from(sources)
            .where(eq(sources.name, 'PMO News Releases'))
            .limit(1)

        if (!source) {
            return NextResponse.json(
                { error: 'PMO source not found in database. Please run registration script.' },
                { status: 404 }
            )
        }

        const stats = await runPMOWorker(source.id, limit)

        return NextResponse.json({
            success: true,
            stats,
        })

    } catch (error) {
        console.error('PMO ingestion failed:', error)
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        )
    }
}
