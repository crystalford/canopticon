import { NextRequest, NextResponse } from 'next/server'
import { db, signals, clusters, rawArticles, clusterArticles } from '@/db'
import { eq } from 'drizzle-orm'

/**
 * GET /api/signals/[id] - Get signal detail with cluster and articles
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        // Fetch signal
        const [signal] = await db
            .select()
            .from(signals)
            .where(eq(signals.id, id))
            .limit(1)

        if (!signal) {
            return NextResponse.json(
                { error: 'Signal not found' },
                { status: 404 }
            )
        }

        // Fetch cluster and primary article
        const [cluster] = await db
            .select()
            .from(clusters)
            .where(eq(clusters.id, signal.clusterId))
            .limit(1)

        // Fetch all cluster articles
        const articles = await db
            .select({
                id: rawArticles.id,
                title: rawArticles.title,
                originalUrl: rawArticles.originalUrl,
                publishedAt: rawArticles.publishedAt,
                bodyText: rawArticles.bodyText,
            })
            .from(clusterArticles)
            .innerJoin(rawArticles, eq(clusterArticles.rawArticleId, rawArticles.id))
            .where(eq(clusterArticles.clusterId, signal.clusterId))

        return NextResponse.json({
            signal,
            cluster,
            articles,
        })
    } catch (error) {
        console.error('Error fetching signal:', error)
        return NextResponse.json(
            { error: 'Failed to fetch signal' },
            { status: 500 }
        )
    }
}

/**
 * PATCH /api/signals/[id] - Update signal status
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await request.json()
        const { status } = body

        if (!status || !['pending', 'flagged', 'approved', 'archived'].includes(status)) {
            return NextResponse.json(
                { error: 'Invalid status' },
                { status: 400 }
            )
        }

        const [updated] = await db
            .update(signals)
            .set({ status, updatedAt: new Date() })
            .where(eq(signals.id, id))
            .returning()

        if (!updated) {
            return NextResponse.json(
                { error: 'Signal not found' },
                { status: 404 }
            )
        }

        return NextResponse.json({ signal: updated })
    } catch (error) {
        console.error('Error updating signal:', error)
        return NextResponse.json(
            { error: 'Failed to update signal' },
            { status: 500 }
        )
    }
}
