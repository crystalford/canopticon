import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('tier').eq('id', user.id).single()
  if (profile?.tier !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { session_id, message } = await request.json()
  if (!session_id || !message) return NextResponse.json({ error: 'session_id and message are required' }, { status: 400 })

  // Load session + history
  const [{ data: session }, { data: history }] = await Promise.all([
    supabase.from('sessions').select('*').eq('id', session_id).single(),
    supabase.from('session_messages').select('*').eq('session_id', session_id).order('created_at').limit(50),
  ])

  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  // Save user message
  await supabase.from('session_messages').insert({ session_id, role: 'user', content: message })

  // Load system prompt
  const { data: promptRow } = await supabase
    .from('system_prompts')
    .select('content')
    .eq('key', 'intelligence_agent')
    .single()

  const systemPrompt = promptRow?.content ?? 'You are CANOPTICON, a Canadian political intelligence analyst.'

  // Build messages for Claude
  const messages: Anthropic.MessageParam[] = [
    ...((history ?? []).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))),
    { role: 'user', content: message },
  ]

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    system: systemPrompt,
    messages,
  })

  const assistantContent = response.content[0].type === 'text' ? response.content[0].text : ''

  // Save assistant response
  await supabase.from('session_messages').insert({
    session_id,
    role: 'assistant',
    content: assistantContent,
  })

  // Update session updated_at
  await supabase.from('sessions').update({ updated_at: new Date().toISOString() }).eq('id', session_id)

  return NextResponse.json({ content: assistantContent })
}
