import { NextResponse } from 'next/server'
import { db } from '@/db'
import { rawArticles, signals, articles } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

export async function GET() {
  try {
    // Count raw articles
    const rawCount = await db.select().from(rawArticles).where(eq(rawArticles.isProcessed, false))
    
    // Count pending signals
    const pendingCount = await db.select().from(signals).where(and(
      eq(signals.status, 'pending'),
      eq(signals.confidenceScore, 0)
    ))
    
    // Count approved signals
    const approvedCount = await db.select().from(signals).where(eq(signals.status, 'approved'))
    
    // Count published articles
    const publishedCount = await db.select().from(articles).where(eq(articles.isDraft, false))
    
    return NextResponse.json({
      rawArticles: rawCount.length,
      pendingSignals: pendingCount.length,
      approvedSignals: approvedCount.length,
      publishedArticles: publishedCount.length
    })
  } catch (error) {
    console.error('Stats error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}
