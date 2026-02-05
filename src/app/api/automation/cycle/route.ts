import { NextResponse } from 'next/server'
import { runAutomationCycle } from '@/lib/automation/engine'

export async function POST() {
  try {
    console.log('[API] Starting automation cycle...')
    const result = await runAutomationCycle()
    console.log('[API] Automation cycle complete:', result)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[API] Automation cycle error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
