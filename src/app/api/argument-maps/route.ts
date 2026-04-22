import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const type = searchParams.get('type')

  let query = supabase.from('argument_maps').select('*').order('updated_at', { ascending: false })
  if (status) query = query.eq('status', status)
  if (type) query = query.eq('article_type', type)

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
  const { title, article_type, argument_tree, dominant_frames, solution_inventory, banked_predictions, five_whys, entity_ids, claim_ids } = body
  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })

  const { data, error } = await supabase.from('argument_maps').insert({
    title,
    article_type: article_type ?? 'analysis',
    argument_tree: argument_tree ?? {},
    dominant_frames: dominant_frames ?? [],
    solution_inventory: solution_inventory ?? { reform: [], resistance: [], exit: [] },
    banked_predictions: banked_predictions ?? [],
    five_whys: five_whys ?? [],
    entity_ids: entity_ids ?? [],
    claim_ids: claim_ids ?? [],
    status: 'draft',
  }).select('id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id }, { status: 201 })
}
