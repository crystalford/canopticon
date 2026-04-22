import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 120

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 70) + '-' + Date.now()
}

function buildTranscript(messages: { role: string; content: string }[]): string {
  return messages
    .map((m) => `[${m.role === 'user' ? 'ANALYST' : 'CANOPTICON'}]\n${m.content}`)
    .join('\n\n---\n\n')
}

const ARTICLE_PROMPT = `You are a Canadian political intelligence analyst. Based on the intelligence session transcript, write a structured article draft.

Return ONLY valid JSON — no markdown fences, no explanation:
{
  "title": "specific, factual headline",
  "summary": "one sentence that captures the core finding",
  "article_type": "analysis",
  "content": "full article in markdown, using ## for section headers, with evidence-graded language"
}

The article must:
- Lead with the most significant finding from the session
- Use ICD 203 probability language ("with high confidence", "evidence suggests", "unlikely but possible")
- Separate confirmed facts from hypotheses — never conflate them
- Include a section on what is NOT yet known (knowledge gaps)
- Reference specific named entities discussed in the session
- Be 400-800 words`

const ARGUMENT_MAP_PROMPT = `You are a Canadian political intelligence analyst. Based on the intelligence session transcript, create a structured argument map.

Return ONLY valid JSON — no markdown fences, no explanation:
{
  "title": "concise title for this argument",
  "article_type": "analysis",
  "argument_tree": {
    "claim": "the single root claim this entire analysis rests on",
    "confidence": 0.0,
    "children": []
  },
  "dominant_frames": [
    { "frame_name": "name of the interpretive frame", "description": "what this frame asserts", "who_benefits": "who gains from this narrative" }
  ],
  "five_whys": [
    { "question": "Why does X happen?", "answer": "Because Y", "level": 1 }
  ],
  "solution_inventory": {
    "reform": ["policy or institutional change that addresses this"],
    "resistance": ["action that contests or disrupts this"],
    "exit": ["option that avoids or routes around this"]
  },
  "banked_predictions": [
    { "claim": "specific falsifiable prediction", "probability": 0.0, "resolution_date": "YYYY-MM-DD", "resolved": false }
  ]
}

Rules:
- Root claim must be the structural finding, not a symptom
- Five Whys must drill from symptom → mechanism → structural cause (stop at 5 or when circular)
- Confidence scores must reflect actual evidence quality from the session
- Predictions must be falsifiable with a specific resolution date
- Only include frames, whys, solutions with real content from the session`

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { type } = await request.json() as { type: 'article' | 'argument_map' }
  if (!type || !['article', 'argument_map'].includes(type)) {
    return NextResponse.json({ error: 'type must be article or argument_map' }, { status: 400 })
  }

  const [{ data: session }, { data: messages }] = await Promise.all([
    supabase.from('sessions').select('title, description').eq('id', params.id).single(),
    supabase.from('session_messages').select('role, content').eq('session_id', params.id).order('created_at').limit(60),
  ])

  if (!session || !messages || messages.length === 0) {
    return NextResponse.json({ error: 'Session not found or empty' }, { status: 404 })
  }

  const transcript = buildTranscript(messages)
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    system: type === 'article' ? ARTICLE_PROMPT : ARGUMENT_MAP_PROMPT,
    messages: [{
      role: 'user',
      content: `Session title: "${session.title}"
${session.description ? `Session description: ${session.description}\n` : ''}
TRANSCRIPT:

${transcript}

Generate the ${type === 'article' ? 'article draft' : 'argument map'} now.`,
    }],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : ''
  let parsed: Record<string, unknown> = {}
  try {
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) parsed = JSON.parse(match[0])
  } catch {
    return NextResponse.json({ error: 'Failed to parse synthesis output', raw }, { status: 500 })
  }

  if (type === 'article') {
    const title = (parsed.title as string) || `Draft from session: ${session.title}`
    const { data, error } = await supabase.from('articles').insert({
      title,
      slug: slugify(title),
      summary: (parsed.summary as string) || null,
      content: (parsed.content as string) || '',
      article_type: (parsed.article_type as string) || 'analysis',
      status: 'draft',
    }).select('id').single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ id: data.id, type: 'article', redirect: `/admin/articles/${data.id}` })
  }

  // Argument map
  const title = (parsed.title as string) || `Draft from session: ${session.title}`
  const { data, error } = await supabase.from('argument_maps').insert({
    title,
    article_type: (parsed.article_type as string) || 'analysis',
    argument_tree: parsed.argument_tree ?? {},
    dominant_frames: parsed.dominant_frames ?? [],
    solution_inventory: parsed.solution_inventory ?? { reform: [], resistance: [], exit: [] },
    banked_predictions: parsed.banked_predictions ?? [],
    five_whys: parsed.five_whys ?? [],
    entity_ids: [],
    claim_ids: [],
    status: 'draft',
  }).select('id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id, type: 'argument_map', redirect: `/admin/argument-maps/${data.id}` })
}
