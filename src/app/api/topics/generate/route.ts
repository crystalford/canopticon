import { NextRequest, NextResponse } from 'next/server'
import { generateArticle } from '@/lib/research/topics'
import { db } from '@/db'
import { articles } from '@/db/schema'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { topic } = body
    
    if (!topic) {
      return NextResponse.json(
        { success: false, error: 'Topic is required' },
        { status: 400 }
      )
    }
    
    console.log(`[v0] Generating article for topic: ${topic.title}`)
    
    const article = await generateArticle(topic)
    
    console.log(`[v0] Article generated: ${article.title}`)
    
    // Save to database
    const [saved] = await db.insert(articles).values({
      title: article.title,
      slug: article.slug,
      summary: article.summary,
      content: article.content,
      isDraft: true, // Save as draft for review
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning()
    
    console.log(`[v0] Article saved to database: ${saved.id}`)
    
    return NextResponse.json({ 
      success: true, 
      article: saved
    })
    
  } catch (error) {
    console.error('[v0] Failed to generate article:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}
