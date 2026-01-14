
import { db, rawArticles, clusters, clusterArticles, signals, logs } from '../db'
import { sql } from 'drizzle-orm'

async function purgeData() {
    console.log('Starting data purge...')

    try {
        // Delete in order of dependency (child -> parent)

        console.log('Deleting signals...')
        await db.delete(signals)

        console.log('Deleting cluster_articles...')
        await db.delete(clusterArticles)

        console.log('Deleting clusters...')
        await db.delete(clusters)

        console.log('Deleting raw_articles...')
        await db.delete(rawArticles)

        console.log('Deleting logs...')
        await db.delete(logs)

        console.log('✅ Purge complete. Database is clean for fresh ingestion.')
        process.exit(0)
    } catch (error) {
        console.error('❌ Purge failed:', error)
        process.exit(1)
    }
}

purgeData()
