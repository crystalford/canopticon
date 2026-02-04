import { NextRequest, NextResponse } from 'next/server'
import {
  getAutomationState,
  setAutomationState,
  getSchedulerConfig,
  updateSchedulerConfig,
  getJobExecutionHistory,
  getRecentMetrics,
  SchedulerConfig,
} from '@/lib/orchestration/scheduler'
import {
  getApprovalRules,
  getPublishingRules,
  updateApprovalRules,
  updatePublishingRules,
  ApprovalRule,
  PublishingRule,
} from '@/lib/orchestration/decisions'

// GET /api/automation/status
// Get full automation status including state, config, recent executions, and rules
export async function GET(request: NextRequest) {
  try {
    console.log('[v0] Fetching automation status...')
    
    const [state, config] = await Promise.all([
      getAutomationState(),
      getSchedulerConfig(),
    ])

    console.log('[v0] Fetched state and config:', { state, config })

    const approvalRules = getApprovalRules()
    const publishingRules = getPublishingRules()

    // Get recent job executions
    const [ingestionHistory, signalProcessingHistory, synthesisHistory, publishingHistory] = await Promise.all([
      getJobExecutionHistory('ingestion', 5),
      getJobExecutionHistory('signal-processing', 5),
      getJobExecutionHistory('synthesis', 5),
      getJobExecutionHistory('publishing', 5),
    ])

    console.log('[v0] Got rules and execution history, attempting to serialize response...')

    const responseData = {
      state,
      config,
      rules: {
        approval: approvalRules,
        publishing: publishingRules,
      },
      executions: {
        ingestion: ingestionHistory,
        signalProcessing: signalProcessingHistory,
        synthesis: synthesisHistory,
        publishing: publishingHistory,
      },
      timestamp: Date.now(),
    }

    console.log('[v0] Response data keys:', Object.keys(responseData))

    return NextResponse.json(responseData, { status: 200 })
  } catch (error) {
    console.error('[v0] Failed to get automation status:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[v0] Error details:', { errorMessage, error })
    return NextResponse.json(
      { error: `Failed to get automation status: ${errorMessage}` },
      { status: 500 }
    )
  }
}

// POST /api/automation/status
// Update automation state and config
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, state, config, approvalRules, publishingRules } = body

    // Update automation state
    if (action === 'setState' && state) {
      await setAutomationState(state)
      console.log(`[v0] Automation state changed to: ${state}`)
    }

    // Update scheduler config
    if (config) {
      await updateSchedulerConfig(config)
      console.log(`[v0] Scheduler config updated`)
    }

    // Update approval rules
    if (approvalRules) {
      updateApprovalRules(approvalRules)
      console.log(`[v0] Approval rules updated`)
    }

    // Update publishing rules
    if (publishingRules) {
      updatePublishingRules(publishingRules)
      console.log(`[v0] Publishing rules updated`)
    }

    // Return updated status
    const [newState, newConfig] = await Promise.all([
      getAutomationState(),
      getSchedulerConfig(),
    ])

    const newApprovalRules = getApprovalRules()
    const newPublishingRules = getPublishingRules()

    // Get recent executions
    const [newIngestionHistory, newSignalProcessingHistory, newSynthesisHistory, newPublishingHistory] = await Promise.all([
      getJobExecutionHistory('ingestion', 5),
      getJobExecutionHistory('signal-processing', 5),
      getJobExecutionHistory('synthesis', 5),
      getJobExecutionHistory('publishing', 5),
    ])

    return NextResponse.json(
      {
        state: newState,
        config: newConfig,
        rules: {
          approval: newApprovalRules,
          publishing: newPublishingRules,
        },
        executions: {
          ingestion: newIngestionHistory,
          signalProcessing: newSignalProcessingHistory,
          synthesis: newSynthesisHistory,
          publishing: newPublishingHistory,
        },
        message: 'Automation configuration updated',
        timestamp: Date.now(),
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[v0] Failed to update automation status:', error)
    return NextResponse.json(
      { error: 'Failed to update automation status' },
      { status: 500 }
    )
  }
}
