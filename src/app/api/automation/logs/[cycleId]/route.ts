import { NextRequest, NextResponse } from 'next/server'
import { getCycleLogs } from '@/lib/orchestration/logging'

// GET /api/automation/logs/[cycleId] - Get logs for a specific cycle
export async function GET(request: NextRequest, { params }: { params: { cycleId: string } }) {
  try {
    const { cycleId } = params
    const logs = await getCycleLogs(cycleId)

    return NextResponse.json(
      {
        cycleId,
        logs,
        total: logs.length,
        timestamp: Date.now(),
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[v0] Failed to get cycle logs:', error)
    return NextResponse.json(
      { error: 'Failed to get cycle logs' },
      { status: 500 }
    )
  }
}