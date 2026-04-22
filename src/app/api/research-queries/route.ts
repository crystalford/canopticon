import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  if (!body.query_text) return NextResponse.json({ error: 'query_text required' }, { status: 400 })

  const { data, error } = await supabase.from('research_queries').insert({
    query_text: body.query_text,
    category: body.category ?? 'general',
    entity_id: body.entity_id ?? null,
    is_active: true,
  }).select('id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id }, { status: 201 })
}
