import { NextResponse } from 'next/server'
import { db } from '@/db'
import { articles } from '@/db/schema'
import { desc } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET() {
    const results = await db.query.articles.findMany({
        columns: {
            id: true,
            title: true,
            slug: true,
            status: true,
            summary: true,
            publishedAt: true,
            createdAt: true,
        },
        orderBy: [desc(articles.createdAt)],
        limit: 100,
    })

    return NextResponse.json(results)
}
