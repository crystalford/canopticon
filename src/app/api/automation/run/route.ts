import { NextRequest, NextResponse } from 'next/server'
import { runAutomationCycle } from '@/lib/orchestration/workflow'

/**
 * POST /api/automation/run
 * Trigger a single automation cycle
 * 
 * Query params (optional):
 * - significanceThreshold: number (default 65)
 * - enableAutoPublish: boolean (default true)
 * - batchSize: number (default 10)
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    const config = {
      significanceThreshold: parseInt(searchParams.get('significanceThreshold') || '65'),
      enableAutoPublish: searchParams.get('enableAutoPublish') !== 'false',
      batchSize: parseInt(searchParams.get('batchSize') || '10'),
    }

    const stats = await runAutomationCycle(config)

    return NextResponse.json({
      success: true,
      cycleId: stats.cycleId,
      stats,
    })

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[AUTOMATION API] Error:', message)
    
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/automation/run
 * Health check / status endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Use POST to trigger automation cycle',
  })
}
