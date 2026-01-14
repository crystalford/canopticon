
import { db, sources } from '../db'
import { eq } from 'drizzle-orm'

async function registerPMO() {
    console.log('Checking for PMO source...')

    const existing = await db
        .select()
        .from(sources)
        .where(eq(sources.name, 'PMO News Releases'))
        .limit(1)

    if (existing.length > 0) {
        console.log('PMO source already exists:', existing[0].id)
        return
    }

    console.log('Registering PMO source...')
    const [source] = await db.insert(sources).values({
        name: 'PMO News Releases',
        protocol: 'rss',
        endpoint: 'https://pm.gc.ca/en/news.rss',
        pollingInterval: '1 hour',
        reliabilityWeight: 90, // High reliability (Official)
        isActive: true,
    }).returning()

    console.log('Registered PMO source:', source.id)
    process.exit(0)
}

registerPMO().catch(err => {
    console.error(err)
    process.exit(1)
})
