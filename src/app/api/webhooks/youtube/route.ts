import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// PubSubHubbub verification — YouTube sends a GET with hub.challenge
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const challenge = searchParams.get('hub.challenge')
  const mode = searchParams.get('hub.mode')
  const topic = searchParams.get('hub.topic')

  if (mode === 'subscribe' && challenge) {
    // Extract channel ID from topic URL
    // topic format: https://www.youtube.com/xml/feeds/videos.xml?channel_id=UCxxxxxxxx
    const channelId = topic ? new URL(topic).searchParams.get('channel_id') : null

    if (channelId) {
      const supabase = createServiceClient()
      const leaseSeconds = searchParams.get('hub.lease_seconds')
      const expiresAt = leaseSeconds
        ? new Date(Date.now() + parseInt(leaseSeconds) * 1000).toISOString()
        : new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString() // default 10 days

      await supabase.from('watched_channels')
        .update({ webhook_subscribed: true, webhook_expires_at: expiresAt })
        .eq('channel_id', channelId)
    }

    return new NextResponse(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } })
  }

  return new NextResponse('Bad Request', { status: 400 })
}

// New video notification from YouTube
export async function POST(request: NextRequest) {
  const body = await request.text()
  const supabase = createServiceClient()

  // Parse Atom XML for video ID and channel ID
  const videoIdMatch = body.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)
  const channelIdMatch = body.match(/<yt:channelId>([^<]+)<\/yt:channelId>/)
  const titleMatch = body.match(/<title>([^<]+)<\/title>/)
  const linkMatch = body.match(/<link rel="alternate" href="([^"]+)"/)

  if (!videoIdMatch || !channelIdMatch) {
    return new NextResponse('OK', { status: 200 }) // Always 200 to stop retries
  }

  const videoId = videoIdMatch[1]
  const channelId = channelIdMatch[1]
  const title = titleMatch ? titleMatch[1] : videoId
  const videoUrl = linkMatch ? linkMatch[1] : `https://www.youtube.com/watch?v=${videoId}`

  // Check channel is watched and active
  const { data: channel } = await supabase
    .from('watched_channels')
    .select('id, last_video_id')
    .eq('channel_id', channelId)
    .eq('is_active', true)
    .single()

  if (!channel) return new NextResponse('OK', { status: 200 })

  // Skip duplicate notifications (YouTube often sends the same video twice)
  if (channel.last_video_id === videoId) return new NextResponse('OK', { status: 200 })

  // Push to intake queue for the news agent to process
  await supabase.from('intake_queue').insert({
    raw_content: `YouTube video published: "${title}"\n\nChannel ID: ${channelId}\nVideo ID: ${videoId}\nURL: ${videoUrl}\n\nFull Atom notification:\n${body}`,
    source_url: videoUrl,
    status: 'pending',
  })

  // Update channel's last seen video and increment counter
  await supabase.from('watched_channels').update({
    last_video_id: videoId,
    last_video_at: new Date().toISOString(),
  }).eq('id', channel.id)

  // Increment videos_ingested — fire and forget, no RPC required
  void supabase.from('watched_channels')
    .select('videos_ingested')
    .eq('id', channel.id)
    .single()
    .then(({ data }) => {
      if (data) {
        void supabase.from('watched_channels')
          .update({ videos_ingested: (data.videos_ingested as number) + 1 })
          .eq('id', channel.id)
      }
    })

  return new NextResponse('OK', { status: 200 })
}
