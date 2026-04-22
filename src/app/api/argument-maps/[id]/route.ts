import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const updates: Record<string, unknown> = {}
  const allowed = ['title', 'article_type', 'argument_tree', 'dominant_frames', 'solution_inventory', 'banked_predictions', 'five_whys', 'entity_ids', 'claim_ids', 'status']
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key]
  }
  if (body.status === 'published') {
    updates.published_at = new Date().toISOString()
  } else if (body.status && body.status !== 'published') {
    updates.published_at = null
  }

  const { error } = await supabase.from('argument_maps').update(updates).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase.from('argument_maps').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
