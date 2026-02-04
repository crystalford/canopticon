import { Redis } from '@upstash/redis'

// Verify Redis is configured
if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
  throw new Error(
    'Redis is required for Canopticon automation to work.\n\n' +
    'The following environment variables are missing:\n' +
    `  - KV_REST_API_URL: ${process.env.KV_REST_API_URL ? '✓' : '✗'}\n` +
    `  - KV_REST_API_TOKEN: ${process.env.KV_REST_API_TOKEN ? '✓' : '✗'}\n\n` +
    'Setup Instructions:\n' +
    '1. Go to https://console.upstash.com and create a Redis database\n' +
    '2. Copy the REST URL and REST Token from your database\n' +
    '3. Add these as environment variables in your Vercel project settings:\n' +
    '   - KV_REST_API_URL (the REST endpoint)\n' +
    '   - KV_REST_API_TOKEN (the access token)\n' +
    '4. Redeploy your application'
  )
}

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
})

export interface SchedulerConfig {
  ingestionIntervalMinutes?: number
  signalProcessingIntervalMinutes?: number
  synthesisIntervalMinutes?: number
  publishingIntervalMinutes?: number
}

const DEFAULT_CONFIG: SchedulerConfig = {
  ingestionIntervalMinutes: 15, // Poll sources every 15 minutes
  signalProcessingIntervalMinutes: 10, // Process signals every 10 minutes
  synthesisIntervalMinutes: 30, // Synthesize articles every 30 minutes
  publishingIntervalMinutes: 5, // Auto-publish every 5 minutes
}

/**
 * Store the last run timestamp for a job
 */
export async function setLastRunTime(jobName: string, timestamp: number): Promise<void> {
  await redis.set(`automation:lastrun:${jobName}`, timestamp)
}

/**
 * Get the last run timestamp for a job
 */
export async function getLastRunTime(jobName: string): Promise<number | null> {
  const result = await redis.get(`automation:lastrun:${jobName}`)
  return result ? parseInt(result as string) : null
}

/**
 * Check if a job should run based on interval
 */
export async function shouldJobRun(
  jobName: string,
  intervalMinutes: number
): Promise<boolean> {
  const lastRun = await getLastRunTime(jobName)
  const now = Date.now()
  const intervalMs = intervalMinutes * 60 * 1000

  if (!lastRun) {
    return true // First run
  }

  return now - lastRun >= intervalMs
}

/**
 * Record a job execution
 */
export async function recordJobExecution(
  jobName: string,
  status: 'success' | 'failure',
  duration: number,
  details?: Record<string, any>
): Promise<void> {
  const execution = {
    jobName,
    status,
    duration,
    timestamp: Date.now(),
    ...details,
  }

  // Store in Redis as a list (keep last 100 executions)
  await redis.lpush(`automation:executions:${jobName}`, JSON.stringify(execution))
  await redis.ltrim(`automation:executions:${jobName}`, 0, 99)
}

/**
 * Get job execution history
 */
export async function getJobExecutionHistory(
  jobName: string,
  limit: number = 20
): Promise<any[]> {
  try {
    const results = await redis.lrange(`automation:executions:${jobName}`, 0, limit - 1)
    return results.map((r) => {
      try {
        return JSON.parse(r as string)
      } catch (e) {
        console.error('[v0] Failed to parse execution record:', r, e)
        return null
      }
    }).filter((r) => r !== null)
  } catch (error) {
    console.error('[v0] Error fetching execution history from Redis:', error)
    return []
  }
}

/**
 * Set automation state (paused/running)
 */
export async function setAutomationState(
  state: 'running' | 'paused'
): Promise<void> {
  await redis.set('automation:state', state)
}

/**
 * Get automation state
 */
export async function getAutomationState(): Promise<'running' | 'paused'> {
  const state = await redis.get('automation:state')
  return (state as 'running' | 'paused') || 'running'
}

/**
 * Update scheduler configuration
 */
export async function updateSchedulerConfig(config: Partial<SchedulerConfig>): Promise<void> {
  const current = await getSchedulerConfig()
  const updated = { ...current, ...config }
  await redis.set('automation:config', JSON.stringify(updated))
}

/**
 * Get current scheduler configuration
 */
export async function getSchedulerConfig(): Promise<SchedulerConfig> {
  try {
    const config = await redis.get('automation:config')
    if (!config) {
      console.log('[v0] No config in Redis, initializing with defaults')
      await redis.set('automation:config', JSON.stringify(DEFAULT_CONFIG))
      return DEFAULT_CONFIG
    }
    
    const parsed = JSON.parse(config as string)
    console.log('[v0] Parsed config from Redis:', parsed)
    return parsed
  } catch (error) {
    console.error('[v0] Error parsing scheduler config from Redis:', error)
    console.log('[v0] Falling back to default config')
    await redis.set('automation:config', JSON.stringify(DEFAULT_CONFIG))
    return DEFAULT_CONFIG
  }
}

/**
 * Record automation metrics
 */
export async function recordMetric(
  metricName: string,
  value: number,
  metadata?: Record<string, any>
): Promise<void> {
  const metric = {
    name: metricName,
    value,
    timestamp: Date.now(),
    ...metadata,
  }
  await redis.lpush('automation:metrics', JSON.stringify(metric))
  await redis.ltrim('automation:metrics', 0, 999) // Keep last 1000 metrics
}

/**
 * Get recent metrics
 */
export async function getRecentMetrics(limit: number = 100): Promise<any[]> {
  try {
    const metrics = await redis.lrange('automation:metrics', 0, limit - 1)
    return metrics.map((m) => {
      try {
        return JSON.parse(m as string)
      } catch (e) {
        console.error('[v0] Failed to parse metric:', m, e)
        return null
      }
    }).filter((m) => m !== null)
  } catch (error) {
    console.error('[v0] Error fetching metrics from Redis:', error)
    return []
  }
}
