import { db } from '@/db'
import { automations } from '@/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import 'dotenv/config' // Helper

async function main() {
    const results = await db.query.automations.findMany({
        where: (automations, { eq, and }) => and(eq(automations.type, 'youtube'), eq(automations.enabled, true))
    })

    console.log('--- Enabled YouTube Automations ---')
    results.forEach(a => {
        const config = a.config as any
        console.log(`Name: ${a.name}`)
        console.log(`Channel ID: ${config.channelId}`)
        console.log(`Subscription URL: https://canopticon.com/api/webhooks/youtube/subscribe?channelId=${config.channelId}`)
        console.log('---')
    })
    process.exit(0)
}

main().catch(console.error)
