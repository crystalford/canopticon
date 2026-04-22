import { createClient } from '@/lib/supabase/server'
import type { Hypothesis } from '@/types/database'
import NewHypothesisForm from './NewHypothesisForm'
import HypothesisActions from './HypothesisActions'

export const dynamic = 'force-dynamic'

const STATUS_STYLES: Record<string, string> = {
  open: 'hypothesis-badge',
  confirmed: 'confirmed-badge',
  refuted: 'disputed-badge',
}

export default async function HypothesesPage() {
  const supabase = createClient()
  const { data: hypotheses } = await supabase
    .from('hypotheses')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(50)

  const counts = { open: 0, confirmed: 0, refuted: 0 }
  for (const h of (hypotheses ?? [])) counts[h.status as keyof typeof counts]++

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-text-primary">Hypotheses</h1>
          <p className="font-mono text-xs text-text-muted mt-1">
            {counts.open} open · {counts.confirmed} confirmed · {counts.refuted} refuted
          </p>
        </div>
      </div>

      <NewHypothesisForm />

      <div className="space-y-3">
        {(hypotheses as Hypothesis[])?.map((h) => (
          <div key={h.id} className="glass-panel p-4 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={STATUS_STYLES[h.status]}>{h.status}</span>
                  <span className="font-mono text-xs text-text-muted">
                    confidence {Math.round(h.confidence * 100)}%
                  </span>
                </div>
                <h3 className="font-display text-sm font-semibold text-text-primary">{h.title}</h3>
                <p className="font-body text-sm text-text-secondary mt-1 leading-relaxed">{h.description}</p>
                <div className="flex gap-4 mt-2 font-mono text-xs text-text-muted">
                  <span>{h.supporting_claim_ids.length} supporting claims</span>
                  <span>{h.contradicting_claim_ids.length} contradicting claims</span>
                </div>
              </div>
              {h.status === 'open' && <HypothesisActions hypothesisId={h.id} />}
            </div>
            <div className="confidence-bar">
              <div
                className={`h-full ${h.confidence >= 0.7 ? 'bg-confirmed' : h.confidence >= 0.4 ? 'bg-hypothesis' : 'bg-disputed'}`}
                style={{ width: `${Math.round(h.confidence * 100)}%` }}
              />
            </div>
          </div>
        ))}
        {(!hypotheses || hypotheses.length === 0) && (
          <div className="glass-panel p-12 text-center font-mono text-xs text-text-muted">No hypotheses yet.</div>
        )}
      </div>
    </div>
  )
}
