import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const entityId = searchParams.get('entity_id')
  const status = searchParams.get('status')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)

  let query = supabase.from('claims').select('*').order('created_at', { ascending: false }).limit(limit)
  if (entityId) query = query.contains('entity_ids', [entityId])
  if (status) query = query.eq('status', status)

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
  const { content, claim_type, confidence, resonance, entity_ids, source_ids } = body
  if (!content) return NextResponse.json({ error: 'content is required' }, { status: 400 })

  const { data, error } = await supabase
    .from('claims')
    .insert({
      content,
      claim_type: claim_type ?? 'assertion',
      confidence: confidence ?? 0.5,
      resonance: resonance ?? 0.0,
      entity_ids: entity_ids ?? [],
      source_ids: source_ids ?? [],
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id }, { status: 201 })
}
