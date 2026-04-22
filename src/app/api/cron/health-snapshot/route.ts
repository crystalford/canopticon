import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const maxDuration = 30

function verifyCron(request: NextRequest) {
  const secret = request.headers.get('authorization')?.replace('Bearer ', '')
  return secret === process.env.CRON_SECRET
}

export async function GET(request: NextRequest) {
  if (!verifyCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  const [
    { count: entities },
    { count: relationships },
    { count: claims },
    { count: sources },
    { count: open_gaps },
    { count: open_hypotheses },
    { count: unresolved_contradictions },
  ] = await Promise.all([
    supabase.from('entities').select('*', { count: 'exact', head: true }),
    supabase.from('relationships').select('*', { count: 'exact', head: true }),
    supabase.from('claims').select('*', { count: 'exact', head: true }),
    supabase.from('sources').select('*', { count: 'exact', head: true }),
    supabase.from('knowledge_gaps').select('*', { count: 'exact', head: true }).eq('is_resolved', false),
    supabase.from('hypotheses').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('contradictions').select('*', { count: 'exact', head: true }).is('resolved_at', null),
  ])

  const snapshot = {
    entities: entities ?? 0,
    relationships: relationships ?? 0,
    claims: claims ?? 0,
    sources: sources ?? 0,
    open_gaps: open_gaps ?? 0,
    open_hypotheses: open_hypotheses ?? 0,
    unresolved_contradictions: unresolved_contradictions ?? 0,
    recorded_at: new Date().toISOString(),
  }

  return NextResponse.json(snapshot)
}
