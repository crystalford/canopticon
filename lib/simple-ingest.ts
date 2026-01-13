import Parser from 'rss-parser'
import { supabase } from '@/lib/db'

const parser = new Parser()

export async function ingestRSS(feedUrl: string, sourceName: string) {
    console.log(`[Ingest] Starting: ${sourceName}`)

    try {
        // 1. Fetch RSS feed
        const feed = await parser.parseURL(feedUrl)

        if (!feed.items) {
            console.log(`[Ingest] No items found in ${sourceName}`)
            return { success: false, count: 0 }
        }

        let inserted = 0

        // 2. Process each item
        for (const item of feed.items) {
            if (!item.link || !item.title) continue

            // Check if already exists
            const { data: existing } = await supabase
                .from('signals')
                .select('id')
                .eq('url', item.link)
                .single()

            if (existing) {
                console.log(`[Ingest] Skip duplicate: ${item.title}`)
                continue
            }

            // Insert new signal
            const { error } = await supabase
                .from('signals')
                .insert({
                    headline: item.title,
                    summary: item.contentSnippet || item.content || 'No summary available',
                    url: item.link,
                    published_at: item.pubDate || new Date().toISOString(),
                    status: 'pending',
                    source: sourceName,
                })

            if (error) {
                console.error(`[Ingest] Error inserting ${item.title}:`, error)
            } else {
                inserted++
                console.log(`[Ingest] ✓ ${item.title}`)
            }
        }

        console.log(`[Ingest] Complete: ${inserted} new items from ${sourceName}`)
        return { success: true, count: inserted }

    } catch (error) {
        console.error(`[Ingest] Failed for ${sourceName}:`, error)
        return { success: false, count: 0, error }
    }
}
