import { NextResponse } from 'next/server'
import { db } from '@/db'
import { logs } from '@/db/schema'
import { desc } from 'drizzle-orm'

export async function GET() {
  try {
    const recentLogs = await db
      .select({
        id: logs.id,
        level: logs.level,
        message: logs.message,
        createdAt: logs.createdAt
      })
      .from(logs)
      .orderBy(desc(logs.createdAt))
      .limit(50)
    
    return NextResponse.json(recentLogs)
  } catch (error) {
    console.error('Logs error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch logs' },
      { status: 500 }
    )
  }
}
