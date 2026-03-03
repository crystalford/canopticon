import { NextResponse } from 'next/server'
import { runAutomationWithContent } from '@/lib/automations/runner'
import { processVideoForMonitor } from '@/lib/videos/pipeline'
import { fetchTranscript } from '@/lib/automations/transcript'
import { db, automations } from '@/db'
import { eq, sql } from 'drizzle-orm'
import RSSParser from 'rss-parser'

const parser = new RSSParser()

// 1. GET Request: Hub Verification
// Google sends a GET request to verify the subscription intent
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const topic = searchParams.get('hub.topic')
    const challenge = searchParams.get('hub.challenge')
    const mode = searchParams.get('hub.mode')

    if (challenge) {
        console.log(`[webhook/youtube] Verifying subscription for topic: ${topic}`)
        return new NextResponse(challenge, { status: 200 })
    }

    return new NextResponse('No challenge', { status: 400 })
}

// 2. POST Request: Notification
// Google sends a POST request with the Atom XML feed of the new video
export async function POST(req: Request) {
    try {
        const text = await req.text()
        console.log(`[webhook/youtube] Received notification`)

        // Parse XML
        // Note: RSSParser usually expects a full feed, but WebSub sends an Atom feed with 1 entry.
        // RSSParser handles Atom.
        const feed = await parser.parseString(text)

        if (!feed.items || feed.items.length === 0) {
            return new NextResponse('No items', { status: 200 })
        }

        const item = feed.items[0]
        // Extract Video ID and Channel ID
        // Atom feed usually has <yt:videoId> and <yt:channelId>
        // RSSParser might put customizable fields in 'isoDate' or custom fields.
        // But 'link' usually works: https://www.youtube.com/watch?v=VIDEO_ID

        const videoLink = item.link
        const videoTitle = item.title
        // item.id is usually "yt:video:VIDEO_ID"

        console.log(`[webhook/youtube] New video: ${videoTitle} (${videoLink})`)

        // Find the matching automation config
        // Only if we stored the channel ID?
        // We might not know WHICH automation this belongs to unless we look up by Channel ID.
        // We need to parse channel ID from the feed.
        // Valid Atom feed from YouTube has <yt:channelId>

        // Let's assume we proceed generically or find the automation
        // For now, let's find ANY enabled youtube automation? No, that's bad.
        // We need to map Channel ID -> Automation.

        // NOTE: RSSParser might not extract yt:channelId by default.
        // We might need to regex it if parser fails.
        const channelIdMatch = text.match(/<yt:channelId>(.*?)<\/yt:channelId>/)
        const channelId = channelIdMatch ? channelIdMatch[1] : null

        if (!channelId) {
            console.error('[webhook/youtube] Could not find channelId in payload')
            return new NextResponse('OK', { status: 200 })
        }

        // Find automation for this channel
        // We store config as jsonb, so we need to query inside it.
        // PostGres JSON query: config->>'channelId' = channelId
        // Match either article pipeline (youtube) or video monitor
        const automation = await db.query.automations.findFirst({
            where: sql`config->>'channelId' = ${channelId} AND type IN ('youtube', 'video_monitor') AND enabled = true`
        })

        if (!automation) {
            console.log(`[webhook/youtube] No enabled automation found for channel ${channelId}`)
            return new NextResponse('OK', { status: 200 })
        }

        const title = videoTitle || 'Untitled Video'
        const link = videoLink || ''

        // Skip stale videos — YouTube re-fires push notifications on subscription renewal
        const pubDate = item.pubDate || item.isoDate
        if (pubDate) {
            const ageMs = Date.now() - new Date(pubDate).getTime()
            const ageHours = ageMs / (1000 * 60 * 60)
            if (ageHours > 18) {
                console.log(`[webhook/youtube] Skipping stale video (${ageHours.toFixed(1)}h old): ${title}`)
                return new NextResponse('OK', { status: 200 })
            }
        }

        if (automation.type === 'video_monitor') {
            const result = await processVideoForMonitor(automation, title, link)
            console.log(`[webhook/youtube] processVideoForMonitor: queued=${result.queued}${result.reason ? ` reason="${result.reason}"` : ''}`)
            await db.update(automations)
                .set({
                    lastRunAt: new Date(),
                    lastResult: result.queued
                        ? { success: true, clipsQueued: 1, trigger: 'push', videoTitle: title }
                        : { success: true, skipped: true, reason: result.reason },
                })
                .where(eq(automations.id, automation.id))
        } else {
            // Article pipeline: build trigger content and run
            const transcript = await fetchTranscript(link)
            const transcriptSection = transcript ? `\nTranscript:\n${transcript}` : ''
            const triggerContent = `Video Title: ${title}\nURL: ${link}\nPublished: ${item.pubDate || ''}\nDescription: ${item.contentSnippet || ''}${transcriptSection}`
            await runAutomationWithContent(automation, triggerContent)
        }

        return new NextResponse('Processed', { status: 200 })

    } catch (error) {
        console.error('[webhook/youtube] Processing failed:', error)
        return NextResponse.json({ error: 'Failed' }, { status: 500 })
    }
}
