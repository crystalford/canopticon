import { NextResponse } from 'next/server'
import { db, automations } from '@/db'
import { eq } from 'drizzle-orm'
import RSSParser from 'rss-parser'

const parser = new RSSParser()

// Fetch recent videos for a YouTube pipeline — used by the detail page retroactive runner
export async function GET(
    _req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const automation = await db.query.automations.findFirst({
            where: eq(automations.id, params.id),
        })
        if (!automation) return NextResponse.json({ error: 'Not found' }, { status: 404 })
        if (automation.type !== 'youtube') {
            return NextResponse.json({ error: 'Not a YouTube pipeline' }, { status: 400 })
        }

        const config = automation.config as Record<string, unknown>
        const channelId = config.channelId as string
        if (!channelId) return NextResponse.json({ error: 'No channelId configured' }, { status: 400 })

        const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
        const feed = await parser.parseURL(feedUrl)

        const videos = feed.items.slice(0, 15).map(item => {
            // Extract video ID from URL: https://www.youtube.com/watch?v=VIDEO_ID
            const videoId = item.link?.match(/v=([^&]+)/)?.[1] || ''
            return {
                videoId,
                title: item.title,
                link: item.link,
                pubDate: item.pubDate,
                isoDate: item.isoDate,
                description: item.contentSnippet || '',
                thumbnail: videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null,
            }
        })

        return NextResponse.json({ videos, channelTitle: feed.title })
    } catch (e: any) {
        console.error('[videos] Error:', e)
        return NextResponse.json({ error: e.message || 'Failed to fetch videos' }, { status: 500 })
    }
}
