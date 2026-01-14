
import { db, systemSettings } from '@/db'
import { eq } from 'drizzle-orm'

export const SETTINGS_KEYS = {
    AI_PROVIDER: 'ai_provider', // 'openai', 'anthropic', 'grok'
    OPENAI_API_KEY: 'openai_api_key',
    ANTHROPIC_API_KEY: 'anthropic_api_key',
    GROK_API_KEY: 'grok_api_key',
} as const

export async function getSetting(key: string): Promise<string | null> {
    try {
        const result = await db
            .select({ value: systemSettings.value })
            .from(systemSettings)
            .where(eq(systemSettings.key, key))
            .limit(1)

        return result.length > 0 ? result[0].value : null
    } catch (error) {
        console.error(`Failed to get setting ${key}:`, error)
        return null
    }
}

export async function setSetting(key: string, value: string): Promise<void> {
    try {
        await db
            .insert(systemSettings)
            .values({
                key,
                value,
                updatedAt: new Date(),
            })
            .onConflictDoUpdate({
                target: systemSettings.key,
                set: {
                    value,
                    updatedAt: new Date(),
                },
            })
    } catch (error) {
        console.error(`Failed to set setting ${key}:`, error)
        throw error
    }
}
