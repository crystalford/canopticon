
import { NextResponse } from 'next/server'
import { db, rawArticles, clusters, clusterArticles, signals, logs } from '@/db'
import { sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function POST() {
    try {
        console.log('Starting data purge via API...')

        // Delete in order of dependency
        await db.delete(signals)
        await db.delete(clusterArticles)
        await db.delete(clusters)
        await db.delete(rawArticles)
        await db.delete(logs)

        return NextResponse.json({ success: true, message: 'Purge complete' })
    } catch (error) {
        console.error('Purge failed:', error)
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
}
