import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncEntityToGraph } from '@/lib/neo4j/sync'
import type { Entity, EntityType } from '@/types/database'

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')
  const type = searchParams.get('type') as EntityType | null
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)

  // Full-text search via tsvector when query provided
  if (q) {
    const { data, error } = await supabase.rpc('search_entities_fts', {
      query_text: q,
      match_count: limit,
      filter_type: type ?? null,
    })
    if (!error) return NextResponse.json(data ?? [])
    // Fall through if FTS function not yet installed
  }

  let query = supabase.from('entities').select('*').order('name').limit(limit)
  if (q) query = query.ilike('name', `%${q}%`)
  if (type) query = query.eq('type', type)

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
  const { name, type, subtype, description, confidence_score, resonance_score } = body

  if (!name || !type) {
    return NextResponse.json({ error: 'name and type are required' }, { status: 400 })
  }

  const entity_id = `ent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  const { data, error } = await supabase
    .from('entities')
    .insert({
      entity_id,
      name,
      type,
      subtype: subtype || null,
      description: description || null,
      confidence_score: confidence_score ?? 0.5,
      resonance_score: resonance_score ?? 0.0,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Sync to Neo4j (non-blocking — don't fail the request if graph is down)
  syncEntityToGraph(data as Entity).catch(console.error)

  return NextResponse.json({ id: data.id }, { status: 201 })
}
