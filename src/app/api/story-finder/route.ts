import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as { lookback_days?: number }
  const lookbackDays = body.lookback_days ?? 7
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString()

  // Pull recent graph activity
  const [
    { data: newEntities },
    { data: recentClaims },
    { data: criticalGaps },
    { data: unconfirmedHypotheses },
    { data: convergences },
    { data: highConfidenceClaims },
  ] = await Promise.all([
    supabase.from('entities').select('name, type, description, confidence_score').gte('created_at', since).order('created_at', { ascending: false }).limit(20),
    supabase.from('claims').select('content, confidence, resonance, entity_ids').gte('created_at', since).order('created_at', { ascending: false }).limit(30),
    supabase.from('knowledge_gaps').select('gap_type, description, urgency_score').eq('is_resolved', false).gte('urgency_score', 0.6).order('urgency_score', { ascending: false }).limit(10),
    supabase.from('hypotheses').select('title, description, confidence').eq('status', 'open').gte('confidence', 0.5).order('confidence', { ascending: false }).limit(10),
    supabase.from('convergence_events').select('claim_ids, source_ids, significance_score, notes').eq('reviewed', false).gte('detected_at', since).order('significance_score', { ascending: false }).limit(5),
    supabase.from('claims').select('content, confidence, resonance').gte('confidence', 0.7).gte('resonance', 0.6).order('confidence', { ascending: false }).limit(10),
  ])

  const graphSummary = `
RECENT GRAPH ACTIVITY (last ${lookbackDays} days):

New entities (${newEntities?.length ?? 0}):
${newEntities?.map((e) => `- ${e.name} (${e.type}, confidence: ${Math.round(e.confidence_score * 100)}%)${e.description ? ': ' + e.description : ''}`).join('\n') || 'None'}

Recent claims (${recentClaims?.length ?? 0}):
${recentClaims?.slice(0, 15).map((c) => `- [conf:${Math.round(c.confidence * 100)}% res:${Math.round(c.resonance * 100)}%] ${c.content}`).join('\n') || 'None'}

High-confidence + high-resonance claims:
${highConfidenceClaims?.map((c) => `- [conf:${Math.round(c.confidence * 100)}% res:${Math.round(c.resonance * 100)}%] ${c.content}`).join('\n') || 'None'}

Critical knowledge gaps:
${criticalGaps?.map((g) => `- [urgency:${Math.round(g.urgency_score * 100)}%] ${g.gap_type}: ${g.description}`).join('\n') || 'None'}

Open hypotheses (high confidence):
${unconfirmedHypotheses?.map((h) => `- [${Math.round(h.confidence * 100)}%] ${h.title}: ${h.description}`).join('\n') || 'None'}

Convergence events (unreviewed):
${convergences?.map((ev) => `- ${ev.claim_ids.length} claims from ${ev.source_ids.length} sources (sig: ${Math.round(ev.significance_score * 100)}%)${ev.notes ? ': ' + ev.notes : ''}`).join('\n') || 'None'}
`.trim()

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: `You are an intelligence analyst identifying which threads in the graph are ready to become public-facing content for CANOPTICON — a Canadian political intelligence channel.

The output is a briefing, not a YouTube video. The audience is intelligent and wants documented findings, not manufactured drama.

Identify 3-5 story threads where:
1. There is enough documented evidence to say something substantive
2. There is a structural finding (not just a surface event)
3. The confidence + resonance profile justifies publication
4. There are knowledge gaps that create genuine investigative angles

Return ONLY valid JSON — no markdown fences, no explanation:
[
  {
    "title": "short, specific, factual — what the story is about",
    "why_now": "what in the recent graph activity makes this timely",
    "structural_finding": "the mechanism or structural condition, not the surface event",
    "evidence_strength": "strong|moderate|weak — honest assessment",
    "knowledge_gaps": ["specific question the story cannot yet answer"],
    "angle": "briefing|investigation|analysis|timeline",
    "suggested_entities": ["entity names from the graph relevant to this story"]
  }
]

Rules:
- No title should contain "The Truth About" or similar manufactured intrigue
- No story should be pitched on vibes — every pitch must cite specific graph evidence
- If the graph has nothing ready, return an empty array
- "why_now" must reference actual recent activity, not generic statements`,
    messages: [{
      role: 'user',
      content: graphSummary + '\n\nIdentify the most defensible story threads in this graph activity.',
    }],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : '[]'
  let stories: unknown[] = []
  try {
    const match = raw.match(/\[[\s\S]*\]/)
    if (match) stories = JSON.parse(match[0])
  } catch {
    return NextResponse.json({ error: 'Failed to parse story finder output', raw }, { status: 500 })
  }

  return NextResponse.json({ stories, lookback_days: lookbackDays, generated_at: new Date().toISOString() })
}
