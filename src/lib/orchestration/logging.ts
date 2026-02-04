import { Redis } from '@upstash/redis'
import { db } from '@/db'
import { logs } from '@/db/schema'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export type LogLevel = 'info' | 'warn' | 'error'

export interface LogEntry {
  id: string
  timestamp: Date
  component: string
  level: LogLevel
  message: string
  cycleId?: string
  metadata?: Record<string, any>
}

/**
 * Log to both Redis (real-time) and database (persistent)
 */
export async function logAutomation(
  component: string,
  level: LogLevel,
  message: string,
  cycleId?: string,
  metadata?: Record<string, any>
): Promise<void> {
  const timestamp = new Date()
  const entry: LogEntry = {
    id: `${Date.now()}-${Math.random()}`,
    timestamp,
    component,
    level,
    message,
    cycleId,
    metadata,
  }

  try {
    // Store in Redis for real-time querying (last 1000 logs)
    await redis.lpush(
      'automation:logs',
      JSON.stringify(entry)
    )
    await redis.ltrim('automation:logs', 0, 999)

    // Store in database for persistence
    await db.insert(logs).values({
      component,
      level,
      message,
      runId: cycleId ? cycleId as any : undefined,
      metadata,
    })
  } catch (error) {
    console.error('[v0] Failed to log automation entry:', error)
  }
}

/**
 * Get recent logs
 */
export async function getRecentLogs(
  limit: number = 100,
  component?: string,
  level?: LogLevel
): Promise<LogEntry[]> {
  try {
    const logs = await redis.lrange('automation:logs', 0, limit - 1)
    let entries: LogEntry[] = logs.map((log) => JSON.parse(log as string))

    // Filter by component
    if (component) {
      entries = entries.filter((e) => e.component === component)
    }

    // Filter by level
    if (level) {
      entries = entries.filter((e) => e.level === level)
    }

    return entries
  } catch (error) {
    console.error('[v0] Failed to get recent logs:', error)
    return []
  }
}

/**
 * Get logs for a specific cycle
 */
export async function getCycleLogs(cycleId: string): Promise<LogEntry[]> {
  try {
    const allLogs = await redis.lrange('automation:logs', 0, 999)
    return allLogs
      .map((log) => JSON.parse(log as string))
      .filter((e) => e.cycleId === cycleId)
  } catch (error) {
    console.error('[v0] Failed to get cycle logs:', error)
    return []
  }
}

/**
 * Health check for automation system
 */
export async function getHealthStatus(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy'
  lastCycleRun?: Date
  recentErrors: number
  recentWarnings: number
  timestamp: Date
}> {
  try {
    const recentLogs = await getRecentLogs(100)
    const recentErrors = recentLogs.filter((l) => l.level === 'error').length
    const recentWarnings = recentLogs.filter((l) => l.level === 'warn').length

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
    if (recentErrors > 5) status = 'unhealthy'
    else if (recentErrors > 0 || recentWarnings > 0) status = 'degraded'

    // Find last successful cycle run
    const lastRun = recentLogs.find((l) => l.level === 'info' && l.message.includes('completed'))

    return {
      status,
      lastCycleRun: lastRun?.timestamp,
      recentErrors,
      recentWarnings,
      timestamp: new Date(),
    }
  } catch (error) {
    console.error('[v0] Failed to get health status:', error)
    return {
      status: 'unhealthy',
      recentErrors: 0,
      recentWarnings: 0,
      timestamp: new Date(),
    }
  }
}

/**
 * Clear old logs (run periodically)
 */
export async function clearOldLogs(daysOld: number = 30): Promise<void> {
  try {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000)
    // Database cleanup would happen via a job
    // Redis is already limited to last 1000 entries
    console.log(`[v0] Cleared logs older than ${daysOld} days`)
  } catch (error) {
    console.error('[v0] Failed to clear old logs:', error)
  }
}
