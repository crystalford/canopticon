import { Redis } from '@upstash/redis'

let redis: Redis | null = null

// In-memory fallback storage
const memoryStore = new Map<string, string>()

try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  } else {
    console.warn('[v0] Redis not configured - automation features will use in-memory storage')
  }
} catch (error) {
  console.warn('[v0] Failed to initialize Redis:', error)
}

// Helper function to set values in either Redis or memory
async function setStoreValue(key: string, value: string): Promise<void> {
  if (redis) {
    await redis.set(key, value)
  } else {
    memoryStore.set(key, value)
  }
}

// Helper function to get values from either Redis or memory
async function getStoreValue(key: string): Promise<string | null> {
  if (redis) {
    return (await redis.get(key)) as string | null
  } else {
    return memoryStore.get(key) || null
  }
}

// In-memory list storage (key -> array of items)
const memoryLists = new Map<string, string[]>()

// Helper function to push items to list
async function lpush(key: string, value: string): Promise<void> {
  if (redis) {
    await redis.lpush(key, value)
  } else {
    if (!memoryLists.has(key)) {
      memoryLists.set(key, [])
    }
    memoryLists.get(key)!.unshift(value)
  }
}

// Helper function to get range from list
async function lrange(key: string, start: number, stop: number): Promise<string[]> {
  if (redis) {
    const results = await redis.lrange(key, start, stop)
    return results as string[]
  } else {
    const list = memoryLists.get(key) || []
    return list.slice(start, stop + 1)
  }
}

// Helper function to trim list
async function ltrim(key: string, start: number, stop: number): Promise<void> {
  if (redis) {
    await redis.ltrim(key, start, stop)
  } else {
    const list = memoryLists.get(key)
    if (list) {
      memoryLists.set(key, list.slice(start, stop + 1))
    }
  }
}

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
  await setStoreValue(`automation:lastrun:${jobName}`, timestamp.toString())
}

/**
 * Get the last run timestamp for a job
 */
export async function getLastRunTime(jobName: string): Promise<number | null> {
  const result = await getStoreValue(`automation:lastrun:${jobName}`)
  return result ? parseInt(result) : null
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

  // Store in Redis/memory as a list (keep last 100 executions)
  await lpush(`automation:executions:${jobName}`, JSON.stringify(execution))
  await ltrim(`automation:executions:${jobName}`, 0, 99)
}

/**
 * Get job execution history
 */
export async function getJobExecutionHistory(
  jobName: string,
  limit: number = 20
): Promise<any[]> {
  const results = await lrange(`automation:executions:${jobName}`, 0, limit - 1)
  return results.map((r) => JSON.parse(r))
}

/**
 * Set automation state (paused/running)
 */
export async function setAutomationState(
  state: 'running' | 'paused'
): Promise<void> {
  await setStoreValue('automation:state', state)
}

/**
 * Get automation state
 */
export async function getAutomationState(): Promise<'running' | 'paused'> {
  const state = await getStoreValue('automation:state')
  return (state as 'running' | 'paused') || 'running'
}

/**
 * Update scheduler configuration
 */
export async function updateSchedulerConfig(config: Partial<SchedulerConfig>): Promise<void> {
  const current = await getSchedulerConfig()
  const updated = { ...current, ...config }
  await setStoreValue('automation:config', JSON.stringify(updated))
}

/**
 * Get current scheduler configuration
 */
export async function getSchedulerConfig(): Promise<SchedulerConfig> {
  const config = await getStoreValue('automation:config')
  if (!config) {
    await setStoreValue('automation:config', JSON.stringify(DEFAULT_CONFIG))
    return DEFAULT_CONFIG
  }
  return JSON.parse(config)
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
  await lpush('automation:metrics', JSON.stringify(metric))
  await ltrim('automation:metrics', 0, 999) // Keep last 1000 metrics
}

/**
 * Get recent metrics
 */
export async function getRecentMetrics(limit: number = 100): Promise<any[]> {
  const metrics = await lrange('automation:metrics', 0, limit - 1)
  return metrics.map((m) => JSON.parse(m))
}
