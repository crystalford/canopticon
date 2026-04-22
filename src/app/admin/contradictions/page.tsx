import { createClient } from '@/lib/supabase/server'
import type { Contradiction } from '@/types/database'
import ResolveButton from './ResolveButton'

export const dynamic = 'force-dynamic'

const SEVERITY_STYLES: Record<string, string> = {
  low: 'font-mono text-xs text-text-muted border border-border bg-raised px-2 py-0.5 rounded-sm',
  medium: 'font-mono text-xs text-signal border border-signal/30 bg-signal/10 px-2 py-0.5 rounded-sm',
  high: 'font-mono text-xs text-disputed border border-disputed/30 bg-disputed/10 px-2 py-0.5 rounded-sm',
  critical: 'font-mono text-xs text-disputed border border-disputed/50 bg-disputed/20 px-2 py-0.5 rounded-sm font-bold',
}

export default async function ContradictionsPage() {
  const supabase = createClient()

  const { data: contradictions } = await supabase
    .from('contradictions')
    .select(`
      *,
      claim_a:claim_a_id(id, content, confidence, status),
      claim_b:claim_b_id(id, content, confidence, status)
    `)
    .is('resolved_at', null)
    .order('detected_at', { ascending: false })
    .limit(50)

  const { data: resolved } = await supabase
    .from('contradictions')
    .select('id')
    .not('resolved_at', 'is', null)

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-display text-xl font-bold text-text-primary">Contradictions</h1>
        <p className="font-mono text-xs text-text-muted mt-1">
          {contradictions?.length ?? 0} unresolved · {resolved?.length ?? 0} resolved
        </p>
      </div>

      <div className="space-y-3">
        {(contradictions as unknown as Array<Contradiction & {
          claim_a: { id: string; content: string; confidence: number; status: string }
          claim_b: { id: string; content: string; confidence: number; status: string }
        }>)?.map((c) => (
          <div key={c.id} className="glass-panel p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={SEVERITY_STYLES[c.severity]}>{c.severity}</span>
                <span className="font-mono text-xs text-text-muted">
                  {new Date(c.detected_at).toLocaleDateString('en-CA')}
                </span>
              </div>
              <ResolveButton contradictionId={c.id} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-void border border-border rounded-sm p-3 space-y-1">
                <p className="font-mono text-[10px] text-text-muted">CLAIM A</p>
                <p className="font-body text-sm text-text-secondary leading-relaxed">{c.claim_a?.content}</p>
                <p className="font-mono text-xs text-text-muted">
                  conf {Math.round((c.claim_a?.confidence ?? 0) * 100)}% · {c.claim_a?.status}
                </p>
              </div>
              <div className="bg-void border border-disputed/20 rounded-sm p-3 space-y-1">
                <p className="font-mono text-[10px] text-text-muted">CLAIM B</p>
                <p className="font-body text-sm text-text-secondary leading-relaxed">{c.claim_b?.content}</p>
                <p className="font-mono text-xs text-text-muted">
                  conf {Math.round((c.claim_b?.confidence ?? 0) * 100)}% · {c.claim_b?.status}
                </p>
              </div>
            </div>
          </div>
        ))}
        {(!contradictions || contradictions.length === 0) && (
          <div className="glass-panel p-12 text-center font-mono text-xs text-text-muted">
            No unresolved contradictions.
          </div>
        )}
      </div>
    </div>
  )
}
