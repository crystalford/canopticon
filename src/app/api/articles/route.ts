import { NextResponse } from 'next/server'
import { db } from '@/db'
import { articles } from '@/db/schema'
import { desc, eq, and } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
    const authError = await requireAuth(req)
    if (authError) return authError

    const { searchParams } = new URL(req.url)
    const automationId = searchParams.get('automationId')

    const results = await db.query.articles.findMany({
        columns: {
            id: true,
            title: true,
            slug: true,
            status: true,
            summary: true,
            automationId: true,
            publishedAt: true,
            createdAt: true,
        },
        where: automationId ? eq(articles.automationId, automationId) : undefined,
        orderBy: [desc(articles.createdAt)],
        limit: 100,
    })

    return NextResponse.json(results)
}
