import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const tier = searchParams.get('tier')
  const q = searchParams.get('q')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)

  let query = supabase.from('sources').select('*').order('created_at', { ascending: false }).limit(limit)
  if (tier) query = query.eq('reliability_tier', tier)
  if (q) query = query.or(`title.ilike.%${q}%,url.ilike.%${q}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('tier').eq('id', user.id).single()
  if (profile?.tier !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { url, title, author, published_at, reliability_tier } = body
  if (!url) return NextResponse.json({ error: 'url is required' }, { status: 400 })

  const { data, error } = await supabase
    .from('sources')
    .insert({ url, title, author, published_at, reliability_tier: reliability_tier ?? 'C' })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id }, { status: 201 })
}
