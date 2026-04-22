import { createClient } from '@/lib/supabase/server'
import type { IntakeQueueItem } from '@/types/database'
import IntakeActions from './IntakeActions'
import IntakeSubmitForm from './IntakeSubmitForm'

export const dynamic = 'force-dynamic'

const STATUS_STYLES: Record<string, string> = {
  pending: 'font-mono text-xs text-signal border border-signal/30 bg-signal/10 px-2 py-0.5 rounded-sm',
  processing: 'font-mono text-xs text-hypothesis border border-hypothesis/30 bg-hypothesis/10 px-2 py-0.5 rounded-sm',
  done: 'font-mono text-xs text-confirmed border border-confirmed/30 bg-confirmed/10 px-2 py-0.5 rounded-sm',
  rejected: 'font-mono text-xs text-disputed border border-disputed/30 bg-disputed/10 px-2 py-0.5 rounded-sm',
}

export default async function IntakePage() {
  const supabase = createClient()

  const { data: items } = await supabase
    .from('intake_queue')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  const byStatus = (items ?? []).reduce((acc: Record<string, number>, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-text-primary">Intake Queue</h1>
          <p className="font-mono text-xs text-text-muted mt-1">
            {byStatus.pending ?? 0} pending · {byStatus.processing ?? 0} processing · {byStatus.done ?? 0} done
          </p>
        </div>
      </div>

      {/* Submit form */}
      <IntakeSubmitForm />

      {/* Queue */}
      <div className="space-y-3">
        {(items as IntakeQueueItem[])?.map((item) => (
          <div key={item.id} className="glass-panel p-4 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={STATUS_STYLES[item.status] ?? STATUS_STYLES.pending}>{item.status}</span>
                  <span className="font-mono text-xs text-text-muted">
                    {new Date(item.created_at).toLocaleString('en-CA')}
                  </span>
                </div>
                {item.source_url && (
                  <a href={item.source_url} target="_blank" rel="noopener noreferrer"
                    className="font-mono text-xs text-hypothesis hover:underline truncate block max-w-sm">
                    {item.source_url}
                  </a>
                )}
                <p className="font-body text-sm text-text-secondary mt-1 line-clamp-3">{item.raw_content}</p>
              </div>
              <IntakeActions itemId={item.id} status={item.status} />
            </div>

            {/* Extracted results */}
            {item.status === 'done' && item.extracted_entities && (
              <div className="border-t border-border pt-3 space-y-2">
                <p className="font-mono text-xs text-signal">Extracted Entities</p>
                <pre className="font-mono text-xs text-text-muted bg-void p-2 rounded-sm overflow-x-auto">
                  {JSON.stringify(item.extracted_entities, null, 2)}
                </pre>
                {item.extracted_claims && (
                  <>
                    <p className="font-mono text-xs text-signal">Extracted Claims</p>
                    <pre className="font-mono text-xs text-text-muted bg-void p-2 rounded-sm overflow-x-auto">
                      {JSON.stringify(item.extracted_claims, null, 2)}
                    </pre>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
        {(!items || items.length === 0) && (
          <div className="glass-panel p-12 text-center font-mono text-xs text-text-muted">
            Queue is empty.
          </div>
        )}
      </div>
    </div>
  )
}
