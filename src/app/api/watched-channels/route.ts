import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('watched_channels')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { channel_id: string; channel_name: string; channel_url?: string }

  if (!body.channel_id || !body.channel_name) {
    return NextResponse.json({ error: 'channel_id and channel_name required' }, { status: 400 })
  }

  // Normalize channel ID — strip URL if someone pasted it
  let channelId = body.channel_id.trim()
  if (channelId.includes('youtube.com/channel/')) {
    channelId = channelId.split('youtube.com/channel/')[1].split('/')[0].split('?')[0]
  }

  const { data, error } = await supabase
    .from('watched_channels')
    .insert({
      channel_id: channelId,
      channel_name: body.channel_name.trim(),
      channel_url: body.channel_url?.trim() ?? `https://www.youtube.com/channel/${channelId}`,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
