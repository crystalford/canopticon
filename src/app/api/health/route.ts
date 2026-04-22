import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createClient()

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

  return NextResponse.json({
    entities: entities ?? 0,
    relationships: relationships ?? 0,
    claims: claims ?? 0,
    sources: sources ?? 0,
    open_gaps: open_gaps ?? 0,
    open_hypotheses: open_hypotheses ?? 0,
    unresolved_contradictions: unresolved_contradictions ?? 0,
    last_snapshot: new Date().toISOString(),
  })
}
