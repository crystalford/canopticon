import { NextRequest, NextResponse } from 'next/server'
import { db, signals, clusters, rawArticles } from '@/db'
import { eq, desc, and } from 'drizzle-orm'

/**
 * GET /api/signals - List signals with optional filtering
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const status = searchParams.get('status')
        const signalType = searchParams.get('signal_type')

        let query = db
            .select({
                id: signals.id,
                signalType: signals.signalType,
                confidenceScore: signals.confidenceScore,
                significanceScore: signals.significanceScore,
                status: signals.status,
                aiNotes: signals.aiNotes,
                createdAt: signals.createdAt,
                clusterId: signals.clusterId,
            })
            .from(signals)
            .orderBy(desc(signals.createdAt))
            .limit(50)

        // Apply filters
        const conditions = []
        if (status) {
            conditions.push(eq(signals.status, status as any))
        }
        if (signalType) {
            conditions.push(eq(signals.signalType, signalType as any))
        }

        if (conditions.length > 0) {
            query = query.where(and(...conditions)) as typeof query
        }

        const result = await query

        return NextResponse.json({ signals: result })
    } catch (error) {
        console.error('Error fetching signals:', error)
        return NextResponse.json(
            { error: 'Failed to fetch signals' },
            { status: 500 }
        )
    }
}
