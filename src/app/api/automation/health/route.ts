import { NextRequest, NextResponse } from 'next/server'
import { getHealthStatus } from '@/lib/orchestration/logging'

// GET /api/automation/health - Health check for automation system
export async function GET(request: NextRequest) {
  try {
    const health = await getHealthStatus()

    // Return appropriate status code based on health
    const statusCode =
      health.status === 'healthy'
        ? 200
        : health.status === 'degraded'
          ? 202
          : 500

    return NextResponse.json(health, { status: statusCode })
  } catch (error) {
    console.error('[v0] Health check failed:', error)
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: 'Health check failed',
        timestamp: new Date(),
      },
      { status: 500 }
    )
  }
}
