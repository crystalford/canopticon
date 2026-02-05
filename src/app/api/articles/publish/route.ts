import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { articles } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { articleId } = body
    
    if (!articleId) {
      return NextResponse.json(
        { success: false, error: 'Article ID is required' },
        { status: 400 }
      )
    }
    
    console.log(`[v0] Publishing article: ${articleId}`)
    
    await db
      .update(articles)
      .set({
        isDraft: false,
        publishedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(articles.id, articleId))
    
    console.log(`[v0] Article published successfully`)
    
    return NextResponse.json({ 
      success: true
    })
    
  } catch (error) {
    console.error('[v0] Failed to publish article:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}
