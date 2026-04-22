import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const maxDuration = 60

function verifyCron(request: NextRequest) {
  const secret = request.headers.get('authorization')?.replace('Bearer ', '')
  return secret === process.env.CRON_SECRET
}

export async function GET(request: NextRequest) {
  if (!verifyCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  const { data: gaps, error } = await supabase
    .from('knowledge_gaps')
    .select('*')
    .eq('is_resolved', false)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!gaps || gaps.length === 0) return NextResponse.json({ escalated: 0 })

  const now = Date.now()
  let escalated = 0

  for (const gap of gaps) {
    const created = new Date(gap.created_at).getTime()
    const lastEscalated = gap.last_escalated_at ? new Date(gap.last_escalated_at).getTime() : created
    const ageMs = now - created
    const daysSinceEscalation = (now - lastEscalated) / (1000 * 60 * 60 * 24)

    // Only escalate once per 24h
    if (daysSinceEscalation < 1) continue

    // Inverse decay: urgency increases with age. Cap at 0.99.
    const ageDays = ageMs / (1000 * 60 * 60 * 24)
    const newUrgency = Math.min(0.99, gap.urgency_score + ageDays * 0.02)

    await supabase.from('knowledge_gaps').update({
      urgency_score: Math.round(newUrgency * 100) / 100,
      last_escalated_at: new Date().toISOString(),
    }).eq('id', gap.id)

    escalated++
  }

  return NextResponse.json({ escalated, total: gaps.length })
}
