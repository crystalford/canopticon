import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Returns Cytoscape-formatted nodes and edges for the graph visualization.
// Limit kept conservative — the browser does the layout computation.
export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const types = searchParams.get('types')?.split(',').filter(Boolean)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '150'), 300)
  const minConfidence = parseFloat(searchParams.get('min_confidence') ?? '0')

  let entityQuery = supabase
    .from('entities')
    .select('id, entity_id, name, type, subtype, description, confidence_score, resonance_score')
    .gte('confidence_score', minConfidence)
    .order('confidence_score', { ascending: false })
    .limit(limit)

  if (types && types.length > 0) {
    entityQuery = entityQuery.in('type', types)
  }

  const { data: entities, error: entErr } = await entityQuery
  if (entErr) return NextResponse.json({ error: entErr.message }, { status: 500 })
  if (!entities || entities.length === 0) return NextResponse.json({ nodes: [], edges: [] })

  const entityIds = entities.map((e) => e.id)

  // Only fetch relationships where both endpoints are in our entity set
  const { data: relationships } = await supabase
    .from('relationships')
    .select('id, from_entity_id, to_entity_id, relationship_type, confidence, is_current')
    .in('from_entity_id', entityIds)
    .in('to_entity_id', entityIds)
    .limit(500)

  const TYPE_COLORS: Record<string, string> = {
    person: '#e8a020',
    organization: '#4da6ff',
    corporation: '#3dd68c',
    government_body: '#c084fc',
    political_party: '#e63946',
    media_outlet: '#f97316',
    policy: '#64748b',
    event: '#94a3b8',
    place: '#6b7280',
    concept: '#8b949e',
  }

  const nodes = entities.map((e) => ({
    data: {
      id: e.id,
      label: e.name,
      type: e.type,
      subtype: e.subtype,
      description: e.description,
      confidence: e.confidence_score,
      resonance: e.resonance_score,
      color: TYPE_COLORS[e.type] ?? '#8b949e',
      // Node size: 18px minimum, scales up with confidence
      size: Math.round(18 + e.confidence_score * 22),
    },
  }))

  const edges = (relationships ?? []).map((r) => ({
    data: {
      id: r.id,
      source: r.from_entity_id,
      target: r.to_entity_id,
      label: r.relationship_type,
      confidence: r.confidence,
      is_current: r.is_current,
    },
  }))

  return NextResponse.json({ nodes, edges, entity_count: nodes.length, edge_count: edges.length })
}
