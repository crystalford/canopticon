import { db, aiUsage } from '@/db'
import { sql, gte, eq, and } from 'drizzle-orm'

/**
 * Cost Control Module (from 09_COST_AND_GATING)
 * 
 * Enforces:
 * - Per-signal AI cost limits
 * - Daily spending caps
 * - Monthly spending caps
 * - Circuit breakers on repeated failures
 */

// Default limits (can be overridden by env vars)
const LIMITS = {
    perSignalUsd: parseFloat(process.env.AI_PER_SIGNAL_LIMIT_USD || '0.50'),
    dailyUsd: parseFloat(process.env.AI_DAILY_LIMIT_USD || '10'),
    monthlyUsd: parseFloat(process.env.AI_MONTHLY_LIMIT_USD || '100'),
} as const

interface CostCheckResult {
    allowed: boolean
    reason?: string
    currentSpend?: number
    limit?: number
}

/**
 * Get today's start for date filtering
 */
function getTodayStart(): Date {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return today
}

/**
 * Get this month's start for date filtering
 */
function getMonthStart(): Date {
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    return monthStart
}

/**
 * Check if we can make an AI call for a signal
 */
export async function checkCostLimits(signalId?: string): Promise<CostCheckResult> {
    try {
        // Check daily limit
        const dailyRecords = await db
            .select({ costUsd: aiUsage.costUsd })
            .from(aiUsage)
            .where(gte(aiUsage.createdAt, getTodayStart()))

        const dailySpend = dailyRecords.reduce((sum, r) => sum + parseFloat(r.costUsd), 0)

        if (dailySpend >= LIMITS.dailyUsd) {
            return {
                allowed: false,
                reason: 'Daily AI cost limit reached',
                currentSpend: dailySpend,
                limit: LIMITS.dailyUsd,
            }
        }

        // Check monthly limit
        const monthlyRecords = await db
            .select({ costUsd: aiUsage.costUsd })
            .from(aiUsage)
            .where(gte(aiUsage.createdAt, getMonthStart()))

        const monthlySpend = monthlyRecords.reduce((sum, r) => sum + parseFloat(r.costUsd), 0)

        if (monthlySpend >= LIMITS.monthlyUsd) {
            return {
                allowed: false,
                reason: 'Monthly AI cost limit reached',
                currentSpend: monthlySpend,
                limit: LIMITS.monthlyUsd,
            }
        }

        // Check per-signal limit if signalId provided
        if (signalId) {
            const signalRecords = await db
                .select({ costUsd: aiUsage.costUsd })
                .from(aiUsage)
                .where(eq(aiUsage.signalId, signalId))

            const signalSpend = signalRecords.reduce((sum, r) => sum + parseFloat(r.costUsd), 0)

            if (signalSpend >= LIMITS.perSignalUsd) {
                return {
                    allowed: false,
                    reason: 'Per-signal AI cost limit reached',
                    currentSpend: signalSpend,
                    limit: LIMITS.perSignalUsd,
                }
            }
        }

        return { allowed: true }
    } catch (error) {
        console.error('Cost check failed:', error)
        // Fail open for now, but log aggressively
        return { allowed: true }
    }
}

/**
 * Record AI usage for tracking
 */
export async function recordAIUsage(params: {
    signalId?: string
    model: string
    promptName: string
    inputTokens: number
    outputTokens: number
    costUsd: number
}): Promise<void> {
    try {
        await db.insert(aiUsage).values({
            signalId: params.signalId,
            model: params.model,
            promptName: params.promptName,
            inputTokens: params.inputTokens,
            outputTokens: params.outputTokens,
            costUsd: params.costUsd.toFixed(6),
        })
    } catch (error) {
        console.error('Failed to record AI usage:', error)
    }
}

/**
 * Get current spending status
 */
export async function getSpendingStatus(): Promise<{
    daily: { spent: number; limit: number; percentage: number }
    monthly: { spent: number; limit: number; percentage: number }
}> {
    const dailyRecords = await db
        .select({ costUsd: aiUsage.costUsd })
        .from(aiUsage)
        .where(gte(aiUsage.createdAt, getTodayStart()))

    const dailySpend = dailyRecords.reduce((sum, r) => sum + parseFloat(r.costUsd), 0)

    const monthlyRecords = await db
        .select({ costUsd: aiUsage.costUsd })
        .from(aiUsage)
        .where(gte(aiUsage.createdAt, getMonthStart()))

    const monthlySpend = monthlyRecords.reduce((sum, r) => sum + parseFloat(r.costUsd), 0)

    return {
        daily: {
            spent: dailySpend,
            limit: LIMITS.dailyUsd,
            percentage: (dailySpend / LIMITS.dailyUsd) * 100,
        },
        monthly: {
            spent: monthlySpend,
            limit: LIMITS.monthlyUsd,
            percentage: (monthlySpend / LIMITS.monthlyUsd) * 100,
        },
    }
}

// Circuit breaker state
let consecutiveFailures = 0
const MAX_CONSECUTIVE_FAILURES = 5
let circuitOpen = false
let circuitOpenedAt: Date | null = null
const CIRCUIT_RESET_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Record an AI call success (resets circuit breaker)
 */
export function recordSuccess(): void {
    consecutiveFailures = 0
    circuitOpen = false
    circuitOpenedAt = null
}

/**
 * Record an AI call failure (may trip circuit breaker)
 */
export function recordFailure(): boolean {
    consecutiveFailures++

    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        circuitOpen = true
        circuitOpenedAt = new Date()
        console.error('Circuit breaker opened due to repeated AI failures')
        return true // Circuit just opened
    }

    return false
}

/**
 * Check if circuit breaker allows AI calls
 */
export function isCircuitOpen(): boolean {
    if (!circuitOpen) return false

    // Check if we should reset
    if (circuitOpenedAt) {
        const elapsed = Date.now() - circuitOpenedAt.getTime()
        if (elapsed >= CIRCUIT_RESET_MS) {
            circuitOpen = false
            circuitOpenedAt = null
            consecutiveFailures = 0
            console.log('Circuit breaker reset')
            return false
        }
    }

    return true
}
