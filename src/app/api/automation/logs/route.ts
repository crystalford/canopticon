import { NextRequest, NextResponse } from 'next/server'
import { getRecentLogs, getCycleLogs, getHealthStatus } from '@/lib/orchestration/logging'

// GET /api/automation/logs - Get recent logs
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const component = searchParams.get('component') || undefined
    const level = searchParams.get('level') || undefined

    const logs = await getRecentLogs(limit, component, level as any)

    return NextResponse.json(
      {
        logs,
        total: logs.length,
        timestamp: Date.now(),
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[v0] Failed to get logs:', error)
    return NextResponse.json(
      { error: 'Failed to get logs' },
      { status: 500 }
    )
  }
}

// GET /api/automation/logs/[cycleId] - Get logs for a specific cycle
export async function GET_CYCLE(request: NextRequest, { params }: { params: { cycleId: string } }) {
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
