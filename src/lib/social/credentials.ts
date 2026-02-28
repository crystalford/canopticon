import { db } from '@/db'
import { settings } from '@/db/schema'
import { eq } from 'drizzle-orm'

/**
 * Resolve a credential: settings table first (editable via UI), then env var.
 */
export async function getCredential(key: string): Promise<string | undefined> {
    try {
        const row = await db.select().from(settings).where(eq(settings.key, key)).limit(1)
        if (row[0]?.value) return row[0].value
    } catch { /* settings table not ready */ }
    return process.env[key]
}
