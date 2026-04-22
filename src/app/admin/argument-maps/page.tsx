import { createClient } from '@/lib/supabase/server'
import type { ArgumentMap } from '@/types/database'
import Link from 'next/link'
import { Plus } from 'lucide-react'

export const dynamic = 'force-dynamic'

const TYPE_LABELS: Record<string, string> = {
  analysis: 'Analysis',
  five_whys: 'Five Whys',
  solution_inventory: 'Solution Inventory',
  prediction: 'Prediction',
  thesis: 'Thesis',
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'text-text-muted border-border',
  published: 'text-confirmed border-confirmed/30 bg-confirmed/10',
  archived: 'text-text-muted border-border bg-raised',
}

export default async function ArgumentMapsPage() {
  const supabase = createClient()
  const { data: maps } = await supabase
    .from('argument_maps')
    .select('*')
    .order('updated_at', { ascending: false })

  const items = (maps ?? []) as ArgumentMap[]

  const counts = {
    total: items.length,
    published: items.filter((m) => m.status === 'published').length,
    draft: items.filter((m) => m.status === 'draft').length,
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-text-primary">Argument Maps</h1>
          <p className="font-mono text-xs text-text-muted mt-1">
            {counts.total} total · {counts.published} published · {counts.draft} draft
          </p>
        </div>
        <Link href="/admin/argument-maps/new" className="btn-primary flex items-center gap-2">
          <Plus size={14} />
          New Map
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="glass-panel p-12 text-center">
          <p className="font-mono text-xs text-text-muted">No argument maps yet.</p>
          <Link href="/admin/argument-maps/new" className="font-mono text-xs text-signal hover:underline mt-2 inline-block">
            Create the first one →
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((map) => (
            <Link
              key={map.id}
              href={`/admin/argument-maps/${map.id}`}
              className="glass-panel p-4 flex items-start gap-4 hover:border-signal/30 transition-colors block"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-sm border text-hypothesis border-hypothesis/30 bg-hypothesis/5">
                    {TYPE_LABELS[map.article_type] ?? map.article_type}
                  </span>
                  <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded-sm border ${STATUS_COLORS[map.status] ?? ''}`}>
                    {map.status}
                  </span>
                </div>
                <p className="font-display text-sm text-text-primary font-medium truncate">{map.title}</p>
                <p className="font-mono text-xs text-text-muted mt-0.5">
                  Updated {new Date(map.updated_at).toLocaleDateString('en-CA')}
                  {map.entity_ids.length > 0 && ` · ${map.entity_ids.length} entities`}
                  {map.banked_predictions.length > 0 && ` · ${map.banked_predictions.length} predictions`}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
