import { NextResponse } from 'next/server'
import { db } from '@/db'
import { articles } from '@/db/schema'
import { desc } from 'drizzle-orm'

export async function GET() {
  try {
    const recentArticles = await db
      .select({
        id: articles.id,
        title: articles.headline,
        slug: articles.slug,
        isDraft: articles.isDraft,
        createdAt: articles.createdAt
      })
      .from(articles)
      .orderBy(desc(articles.createdAt))
      .limit(10)
    
    return NextResponse.json(recentArticles)
  } catch (error) {
    console.error('Articles error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch articles' },
      { status: 500 }
    )
  }
}
