import { RawArticleInput, ingestRawArticle, IngestionResult } from './core'
import { db, logs, sources } from '@/db'
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'

/**
 * Parliament of Canada API Worker
 * 
 * Fetches data from the Parliament of Canada open data sources.
 * Primary endpoints:
 * - LEGISinfo: https://www.parl.ca/legisinfo/
 * - Open Parliament: https://openparliament.ca/api/
 */

const OPEN_PARLIAMENT_BASE = 'https://api.openparliament.ca'

interface OpenParliamentBill {
    url: string
    name: string
    number: string
    session: string
    introduced: string
    legisinfo_url: string
    text_url?: string
    status_code?: string
}

interface OpenParliamentVote {
    url: string
    date: string
    number: number
    result: string
    description: string
    bill_url?: string
    yea_total: number
    nay_total: number
}

/**
 * Fetch recent bills from Open Parliament API
 */
export async function fetchRecentBills(limit: number = 20): Promise<OpenParliamentBill[]> {
    try {
        const response = await fetch(`${OPEN_PARLIAMENT_BASE}/bills/?limit=${limit}&format=json`, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'CANOPTICON/1.0 (Political Research)',
            },
        })

        if (!response.ok) {
            console.error(`Open Parliament API error: ${response.status}`)
            return []
        }

        const data = await response.json()
        return data.objects || []

    } catch (error) {
        console.error('Failed to fetch bills:', error)
        return []
    }
}

/**
 * Fetch recent votes from Open Parliament API
 */
export async function fetchRecentVotes(limit: number = 20): Promise<OpenParliamentVote[]> {
    try {
        const response = await fetch(`${OPEN_PARLIAMENT_BASE}/votes/?limit=${limit}&format=json`, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'CANOPTICON/1.0 (Political Research)',
            },
        })

        if (!response.ok) {
            console.error(`Open Parliament API error: ${response.status}`)
            return []
        }

        const data = await response.json()
        return data.objects || []

    } catch (error) {
        console.error('Failed to fetch votes:', error)
        return []
    }
}

/**
 * Convert a bill to raw article format
 */
function billToRawArticle(bill: OpenParliamentBill, sourceId: string): RawArticleInput {
    const bodyText = `
Bill ${bill.number} - ${bill.name}

Session: ${bill.session}
Introduced: ${bill.introduced}
Status: ${bill.status_code || 'Unknown'}

This bill was introduced in the Parliament of Canada during session ${bill.session}. 
For full text and updates, see the official LEGISinfo page.
  `.trim()

    return {
        sourceId,
        externalId: bill.url,
        originalUrl: bill.legisinfo_url || `https://openparliament.ca${bill.url}`,
        title: `Bill ${bill.number}: ${bill.name}`,
        bodyText,
        publishedAt: bill.introduced ? new Date(bill.introduced) : undefined,
        rawPayload: bill as unknown as Record<string, unknown>,
    }
}

/**
 * Convert a vote to raw article format
 */
function voteToRawArticle(vote: OpenParliamentVote, sourceId: string): RawArticleInput {
    const bodyText = `
House of Commons Vote #${vote.number}

Date: ${vote.date}
Result: ${vote.result}
Yeas: ${vote.yea_total} | Nays: ${vote.nay_total}

${vote.description}

This vote was recorded in the House of Commons on ${vote.date}. 
The motion ${vote.result === 'Agreed to' ? 'passed' : 'failed'} with ${vote.yea_total} votes in favor and ${vote.nay_total} against.
  `.trim()

    return {
        sourceId,
        externalId: vote.url,
        originalUrl: `https://openparliament.ca${vote.url}`,
        title: `Vote #${vote.number}: ${vote.description.slice(0, 100)}...`,
        bodyText,
        publishedAt: new Date(vote.date),
        rawPayload: vote as unknown as Record<string, unknown>,
    }
}

/**
 * Run the Parliament worker to fetch and ingest new content
 */
export async function runParliamentWorker(sourceId: string): Promise<{
    processed: number
    ingested: number
    skipped: number
    errors: number
}> {
    const runId = uuidv4()
    const stats = { processed: 0, ingested: 0, skipped: 0, errors: 0 }

    await db.insert(logs).values({
        component: 'parliament-worker',
        runId,
        level: 'info',
        message: 'Parliament worker started',
        metadata: { sourceId },
    })

    try {
        // Fetch bills
        const bills = await fetchRecentBills(10)
        for (const bill of bills) {
            stats.processed++
            const article = billToRawArticle(bill, sourceId)
            const result = await ingestRawArticle(article)

            if (result.success) {
                if (result.skipped) stats.skipped++
                else stats.ingested++
            } else {
                stats.errors++
            }
        }

        // Fetch votes
        const votes = await fetchRecentVotes(10)
        for (const vote of votes) {
            stats.processed++
            const article = voteToRawArticle(vote, sourceId)
            const result = await ingestRawArticle(article)

            if (result.success) {
                if (result.skipped) stats.skipped++
                else stats.ingested++
            } else {
                stats.errors++
            }
        }

        await db.insert(logs).values({
            component: 'parliament-worker',
            runId,
            level: 'info',
            message: 'Parliament worker completed',
            metadata: stats,
        })

    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        await db.insert(logs).values({
            component: 'parliament-worker',
            runId,
            level: 'error',
            message: `Parliament worker failed: ${message}`,
            metadata: { sourceId },
        })
        stats.errors++
    }

    return stats
}

/**
 * Get or create the Parliament source
 */
export async function ensureParliamentSource(): Promise<string> {
    const existing = await db
        .select()
        .from(sources)
        .where(eq(sources.name, 'Parliament of Canada'))
        .limit(1)

    if (existing.length > 0) {
        return existing[0].id
    }

    const [created] = await db.insert(sources).values({
        name: 'Parliament of Canada',
        protocol: 'json',
        endpoint: OPEN_PARLIAMENT_BASE,
        pollingInterval: '1 hour',
        reliabilityWeight: 90,
        isActive: true,
    }).returning({ id: sources.id })

    return created.id
}
