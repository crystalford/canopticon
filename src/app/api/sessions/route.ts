import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(50)

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
  const { title, description, entity_ids } = body
  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 })

  const { data, error } = await supabase
    .from('sessions')
    .insert({ title, description: description ?? null, entity_ids: entity_ids ?? [] })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id }, { status: 201 })
}
