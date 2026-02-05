import { NextResponse } from 'next/server'
import { findCurrentTopics } from '@/lib/research/topics'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST() {
  try {
    console.log('[v0] Finding current topics...')
    
    const topics = await findCurrentTopics()
    
    console.log(`[v0] Found ${topics.length} topics`)
    
    return NextResponse.json({ 
      success: true, 
      topics 
    })
    
  } catch (error) {
    console.error('[v0] Failed to find topics:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}
