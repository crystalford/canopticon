import { createClient } from '@/lib/supabase/server'
import type { Vlog } from '@/types/database'
import NewVlogForm from './NewVlogForm'
import VlogActions from './VlogActions'
import { Video, ExternalLink } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function VlogsPage() {
  const supabase = createClient()
  const { data: vlogs } = await supabase
    .from('vlogs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  const published = (vlogs ?? []).filter(v => v.status === 'published').length
  const drafts = (vlogs ?? []).filter(v => v.status === 'draft').length

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-text-primary">Vlogs</h1>
          <p className="font-mono text-xs text-text-muted mt-1">{published} published · {drafts} drafts</p>
        </div>
      </div>

      <NewVlogForm />

      <div className="space-y-3">
        {(vlogs as Vlog[])?.map((vlog) => (
          <div key={vlog.id} className="glass-panel p-4 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Video size={13} className="text-text-muted shrink-0" />
                  <span className="font-display text-sm font-semibold text-text-primary">{vlog.title}</span>
                  <span className={`font-mono text-xs px-2 py-0.5 rounded-sm border ${
                    vlog.status === 'published'
                      ? 'text-confirmed border-confirmed/30 bg-confirmed/10'
                      : 'text-text-muted border-border bg-raised'
                  }`}>{vlog.status}</span>
                </div>
                {vlog.youtube_url && (
                  <a href={vlog.youtube_url} target="_blank" rel="noopener noreferrer"
                    className="font-mono text-xs text-hypothesis hover:underline flex items-center gap-1">
                    {vlog.youtube_url}
                    <ExternalLink size={10} />
                  </a>
                )}
                {vlog.script && (
                  <p className="font-body text-sm text-text-secondary mt-1 line-clamp-2 leading-relaxed">{vlog.script}</p>
                )}
                <p className="font-mono text-xs text-text-muted mt-1">
                  {new Date(vlog.created_at).toLocaleDateString('en-CA')}
                </p>
              </div>
              <VlogActions vlogId={vlog.id} status={vlog.status} />
            </div>
          </div>
        ))}
        {(!vlogs || vlogs.length === 0) && (
          <div className="glass-panel p-12 text-center font-mono text-xs text-text-muted">
            No vlogs yet. Add a YouTube URL and script to get started.
          </div>
        )}
      </div>
    </div>
  )
}
