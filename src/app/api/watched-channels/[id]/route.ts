import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Subscribe or unsubscribe a channel from PubSubHubbub
async function manageWebhook(channelId: string, mode: 'subscribe' | 'unsubscribe') {
  const hubUrl = 'https://pubsubhubbub.appspot.com/subscribe'
  const topic = `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${channelId}`
  const callbackUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://canopticon.ca'}/api/webhooks/youtube`

  const body = new URLSearchParams({
    'hub.callback': callbackUrl,
    'hub.topic': topic,
    'hub.verify': 'async',
    'hub.mode': mode,
    'hub.lease_seconds': '864000', // 10 days
  })

  const res = await fetch(hubUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  return res.status === 202 || res.status === 200
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { action?: 'subscribe' | 'unsubscribe'; is_active?: boolean; channel_name?: string }

  const { data: channel } = await supabase
    .from('watched_channels')
    .select('channel_id, webhook_subscribed')
    .eq('id', params.id)
    .single()

  if (!channel) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Handle webhook subscription action
  if (body.action === 'subscribe' || body.action === 'unsubscribe') {
    const ok = await manageWebhook(channel.channel_id, body.action)
    if (!ok) return NextResponse.json({ error: 'PubSubHubbub request failed' }, { status: 502 })

    const update: Record<string, unknown> = {}
    if (body.action === 'unsubscribe') {
      update.webhook_subscribed = false
      update.webhook_expires_at = null
    }
    // subscribe: webhook_subscribed gets set to true when YouTube sends the verification GET

    if (Object.keys(update).length > 0) {
      await supabase.from('watched_channels').update(update).eq('id', params.id)
    }

    return NextResponse.json({ ok: true, action: body.action })
  }

  // Handle field updates
  const update: Record<string, unknown> = {}
  if (typeof body.is_active === 'boolean') update.is_active = body.is_active
  if (body.channel_name) update.channel_name = body.channel_name

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('watched_channels')
    .update(update)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: channel } = await supabase
    .from('watched_channels')
    .select('channel_id, webhook_subscribed')
    .eq('id', params.id)
    .single()

  if (!channel) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (channel.webhook_subscribed) {
    await manageWebhook(channel.channel_id, 'unsubscribe').catch(() => null)
  }

  await supabase.from('watched_channels').delete().eq('id', params.id)
  return NextResponse.json({ ok: true })
}
