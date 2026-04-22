import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncRelationshipToGraph } from '@/lib/neo4j/sync'
import type { Relationship } from '@/types/database'

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const entityId = searchParams.get('entity_id')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)

  let query = supabase.from('relationships').select('*, from:from_entity_id(id,name,type,entity_id), to:to_entity_id(id,name,type,entity_id)')
    .order('created_at', { ascending: false }).limit(limit)

  if (entityId) {
    query = query.or(`from_entity_id.eq.${entityId},to_entity_id.eq.${entityId}`)
  }

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
  const { from_entity_id, to_entity_id, relationship_type, confidence, start_date, end_date, is_current } = body

  if (!from_entity_id || !to_entity_id || !relationship_type) {
    return NextResponse.json({ error: 'from_entity_id, to_entity_id, and relationship_type are required' }, { status: 400 })
  }

  // Verify both entities exist and get their entity_ids for Neo4j
  const { data: entities } = await supabase
    .from('entities')
    .select('id, entity_id')
    .in('id', [from_entity_id, to_entity_id])

  if (!entities || entities.length < 2) {
    return NextResponse.json({ error: 'One or both entities not found' }, { status: 404 })
  }

  const fromEntity = entities.find(e => e.id === from_entity_id)
  const toEntity = entities.find(e => e.id === to_entity_id)

  const { data, error } = await supabase
    .from('relationships')
    .insert({
      from_entity_id,
      to_entity_id,
      relationship_type,
      confidence: confidence ?? 0.5,
      start_date: start_date ?? null,
      end_date: end_date ?? null,
      is_current: is_current ?? true,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (fromEntity && toEntity) {
    syncRelationshipToGraph(data as Relationship, fromEntity.entity_id, toEntity.entity_id).catch(console.error)
  }

  return NextResponse.json({ id: data.id }, { status: 201 })
}
