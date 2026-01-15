import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { runParliamentWorker, ensureParliamentSource } from '@/lib/ingestion/parliament-worker'
import { runPMOWorker } from '@/lib/ingestion/pmo-worker'
import { db, sources } from '@/db'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Allow 60s timeout

export async function POST() {
    try {
        const session = await getServerSession()
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // 1. Ensure Sources Exist
        const parlSourceId = await ensureParliamentSource()

        // Ensure PMO Source
        let pmoSourceId = ''
        const pmoSource = await db.query.sources.findFirst({ where: eq(sources.name, 'PMO Press Office') })
        if (pmoSource) {
            pmoSourceId = pmoSource.id
        } else {
            const [newPmo] = await db.insert(sources).values({
                name: 'PMO Press Office',
                protocol: 'json', // technically RSS/XML
                endpoint: 'https://pm.gc.ca/en/news.rss',
                reliabilityWeight: 80,
                isActive: true
            }).returning()
            pmoSourceId = newPmo.id
        }

        // 2. Run Workers
        const parlStats = await runParliamentWorker(parlSourceId, 10)
        const pmoStats = await runPMOWorker(pmoSourceId, 10)

        return NextResponse.json({
            success: true,
            stats: {
                parliament: parlStats,
                pmo: pmoStats
            }
        })

    } catch (error) {
        console.error('Feed Refresh Error:', error)
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        )
    }
}
