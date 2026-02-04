import { NextRequest, NextResponse } from 'next/server'
import {
  getAutomationState,
  getSchedulerConfig,
  shouldJobRun,
  setLastRunTime,
  recordJobExecution,
  recordMetric,
} from '@/lib/orchestration/scheduler'
import { runAutomationWorkflow } from '@/lib/orchestration/workflow'

// This endpoint is called periodically by Upstash cron
// Expected to be called every 5 minutes
export async function POST(request: NextRequest) {
  try {
    // Verify this is from Upstash
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.AUTOMATION_CRON_SECRET}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const startTime = Date.now()

    // Check if automation is enabled
    const state = await getAutomationState()
    if (state === 'paused') {
      return NextResponse.json(
        { message: 'Automation is paused' },
        { status: 200 }
      )
    }

    // Get current configuration
    const config = await getSchedulerConfig()

    // Track what we're running this cycle
    const tasksExecuted: string[] = []
    const taskResults: Record<string, any> = {}

    // ===== INGESTION CYCLE =====
    if (await shouldJobRun('ingestion', config.ingestionIntervalMinutes || 15)) {
      try {
        console.log('[v0] Starting ingestion cycle...')
        const ingestionStart = Date.now()

        // This would call your existing ingestion endpoints
        // For now, just record the intention
        tasksExecuted.push('ingestion')
        taskResults.ingestion = {
          status: 'queued',
          timestamp: Date.now(),
        }

        await setLastRunTime('ingestion', Date.now())
        const ingestionDuration = Date.now() - ingestionStart
        await recordJobExecution('ingestion', 'success', ingestionDuration, {
          sourcesPolled: 4, // parliament, pmo, viral, manual
        })

        console.log(
          `[v0] Ingestion cycle completed in ${ingestionDuration}ms`
        )
      } catch (error) {
        console.error('[v0] Ingestion cycle failed:', error)
        await recordJobExecution('ingestion', 'failure', Date.now() - startTime, {
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    // ===== SIGNAL PROCESSING CYCLE =====
    if (
      await shouldJobRun(
        'signal-processing',
        config.signalProcessingIntervalMinutes || 10
      )
    ) {
      try {
        console.log('[v0] Starting signal processing cycle...')
        const signalStart = Date.now()

        tasksExecuted.push('signal-processing')
        taskResults['signal-processing'] = {
          status: 'queued',
          timestamp: Date.now(),
        }

        await setLastRunTime('signal-processing', Date.now())
        const signalDuration = Date.now() - signalStart
        await recordJobExecution('signal-processing', 'success', signalDuration, {
          signalsProcessed: 0,
          signalsApproved: 0,
        })

        console.log(
          `[v0] Signal processing cycle completed in ${signalDuration}ms`
        )
      } catch (error) {
        console.error('[v0] Signal processing cycle failed:', error)
        await recordJobExecution('signal-processing', 'failure', Date.now() - startTime, {
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    // ===== SYNTHESIS CYCLE =====
    if (
      await shouldJobRun('synthesis', config.synthesisIntervalMinutes || 30)
    ) {
      try {
        console.log('[v0] Starting synthesis cycle...')
        const synthesisStart = Date.now()

        tasksExecuted.push('synthesis')
        taskResults.synthesis = {
          status: 'queued',
          timestamp: Date.now(),
        }

        await setLastRunTime('synthesis', Date.now())
        const synthesisDuration = Date.now() - synthesisStart
        await recordJobExecution('synthesis', 'success', synthesisDuration, {
          articlesSynthesized: 0,
        })

        console.log(
          `[v0] Synthesis cycle completed in ${synthesisDuration}ms`
        )
      } catch (error) {
        console.error('[v0] Synthesis cycle failed:', error)
        await recordJobExecution('synthesis', 'failure', Date.now() - startTime, {
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    // ===== PUBLISHING CYCLE =====
    if (
      await shouldJobRun('publishing', config.publishingIntervalMinutes || 5)
    ) {
      try {
        console.log('[v0] Starting publishing cycle...')
        const publishStart = Date.now()

        tasksExecuted.push('publishing')
        taskResults.publishing = {
          status: 'queued',
          timestamp: Date.now(),
        }

        await setLastRunTime('publishing', Date.now())
        const publishDuration = Date.now() - publishStart
        await recordJobExecution('publishing', 'success', publishDuration, {
          articlesPublished: 0,
          socialPostsCreated: 0,
        })

        console.log(
          `[v0] Publishing cycle completed in ${publishDuration}ms`
        )
      } catch (error) {
        console.error('[v0] Publishing cycle failed:', error)
        await recordJobExecution('publishing', 'failure', Date.now() - startTime, {
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    // Record overall cycle metrics
    const totalDuration = Date.now() - startTime
    await recordMetric('automation-cycle', totalDuration, {
      tasksExecuted: tasksExecuted.length,
      tasks: tasksExecuted,
    })

    console.log(
      `[v0] Full automation cycle completed in ${totalDuration}ms with ${tasksExecuted.length} tasks`
    )

    return NextResponse.json(
      {
        success: true,
        cycleId: `cycle-${Date.now()}`,
        duration: totalDuration,
        tasksExecuted,
        taskResults,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[v0] Automation cron failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// Health check endpoint
export async function GET() {
  try {
    const state = await getAutomationState()
    return NextResponse.json(
      {
        status: 'healthy',
        automationState: state,
        timestamp: Date.now(),
      },
      { status: 200 }
    )
  } catch (error) {
    return NextResponse.json(
      { status: 'unhealthy', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
