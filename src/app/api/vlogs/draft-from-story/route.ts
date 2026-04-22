import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 120

interface StoryPitch {
  title: string
  why_now: string
  structural_finding: string
  evidence_strength: string
  knowledge_gaps: string[]
  angle: string
  suggested_entities: string[]
}

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 70) + '-' + Date.now()
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { story } = await request.json() as { story: StoryPitch }
  if (!story?.title) return NextResponse.json({ error: 'story required' }, { status: 400 })

  const { data: voicePromptRow } = await supabase
    .from('system_prompts')
    .select('content')
    .eq('key', 'voice_profile')
    .single()

  const voiceProfile = voicePromptRow?.content ?? ''

  // Pull relevant claims from the graph for the suggested entities
  let graphContext = ''
  if (story.suggested_entities.length > 0) {
    const { data: entities } = await supabase
      .from('entities')
      .select('id, name, description, confidence_score')
      .in('name', story.suggested_entities)
      .limit(10)

    if (entities && entities.length > 0) {
      const entityIds = entities.map((e) => e.id)
      const { data: claims } = await supabase
        .from('claims')
        .select('content, confidence, resonance')
        .overlaps('entity_ids', entityIds)
        .gte('confidence', 0.4)
        .order('confidence', { ascending: false })
        .limit(20)

      const entityLines = entities.map((e) =>
        `${e.name} (confidence: ${Math.round(e.confidence_score * 100)}%)${e.description ? ': ' + e.description : ''}`
      ).join('\n')

      const claimLines = claims?.map((c) =>
        `[conf:${Math.round(c.confidence * 100)}% res:${Math.round(c.resonance * 100)}%] ${c.content}`
      ).join('\n') ?? ''

      graphContext = `\nEntities from the graph:\n${entityLines}\n\nRelevant claims:\n${claimLines}`
    }
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    system: voiceProfile,
    messages: [{
      role: 'user',
      content: `Write a video script for CANOPTICON about the following story.

Story: ${story.title}
Angle: ${story.angle}
Evidence strength: ${story.evidence_strength}

Why this story now:
${story.why_now}

Structural finding (lead with this):
${story.structural_finding}

What we don't know yet:
${story.knowledge_gaps.join('\n')}
${graphContext}

Write the script now. Plain text, spoken aloud. No stage directions, no section labels. Lead with the structural finding. State what is documented, what is inferred, and what remains unknown. End when there is nothing more to say.`,
    }],
  })

  const script = response.content[0].type === 'text' ? response.content[0].text : ''

  const { data: vlog, error } = await supabase
    .from('vlogs')
    .insert({
      title: story.title,
      script,
      status: 'draft',
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: vlog.id, redirect: `/admin/vlogs/${vlog.id}` })
}
