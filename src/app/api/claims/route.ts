import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const entityId = searchParams.get('entity_id')
  const status = searchParams.get('status')
  const q = searchParams.get('q')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)

  // Full-text search via tsvector when query provided
  if (q) {
    const { data, error } = await supabase.rpc('search_claims_fts', {
      query_text: q,
      match_count: limit,
      filter_entity_id: entityId ?? null,
      filter_status: status ?? null,
    })
    if (!error) return NextResponse.json(data ?? [])
    // Fall through to plain list if FTS function not yet installed
  }

  let query = supabase
    .from('claims')
    .select('id, content, confidence, resonance, status, entity_ids, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
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

  // search_vector is maintained automatically by the claims_search_trigger
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
