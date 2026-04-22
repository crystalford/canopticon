import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 120

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: vlog } = await supabase
    .from('vlogs')
    .select('id, title, transcript')
    .eq('id', params.id)
    .single()

  if (!vlog) return NextResponse.json({ error: 'Vlog not found' }, { status: 404 })

  const { data: voicePromptRow } = await supabase
    .from('system_prompts')
    .select('content')
    .eq('key', 'voice_profile')
    .single()

  const voiceProfile = voicePromptRow?.content ?? ''

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    system: voiceProfile,
    messages: [{
      role: 'user',
      content: `Write a video script for CANOPTICON based on the following source material.

Title: ${vlog.title}

${vlog.transcript ? `Source transcript:\n\n${vlog.transcript.substring(0, 8000)}` : 'No transcript available — write from the title context only.'}

Write the script now. Plain text, spoken aloud. No stage directions. No [PAUSE] markers. No section headers formatted as "INTRO:" or "CONCLUSION:". Just the words, in order.`,
    }],
  })

  const script = response.content[0].type === 'text' ? response.content[0].text : ''

  await supabase.from('vlogs').update({ script }).eq('id', params.id)

  return NextResponse.json({ script })
}
