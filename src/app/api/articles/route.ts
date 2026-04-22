import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('tier').eq('id', user.id).single()
  if (profile?.tier !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { title, content, summary, status } = body
  if (!title || !content) return NextResponse.json({ error: 'title and content required' }, { status: 400 })

  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') +
    '-' + Date.now().toString(36)

  const { data, error } = await supabase.from('articles').insert({
    title, content, summary: summary ?? null, status: status ?? 'draft', slug,
    published_at: status === 'published' ? new Date().toISOString() : null,
  }).select('id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id }, { status: 201 })
}
