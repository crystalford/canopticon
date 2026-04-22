import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import VlogPipeline from './VlogPipeline'

export const dynamic = 'force-dynamic'

export default async function VlogDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: vlog } = await supabase
    .from('vlogs')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!vlog) notFound()

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/vlogs" className="text-text-muted hover:text-text-secondary transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex items-center gap-2">
          <span className={`font-mono text-xs px-2 py-0.5 rounded-sm border ${
            vlog.status === 'published'
              ? 'text-confirmed border-confirmed/30 bg-confirmed/10'
              : 'text-text-muted border-border bg-raised'
          }`}>{vlog.status}</span>
          {vlog.processing_status && vlog.processing_status !== 'none' && (
            <span className={`font-mono text-xs px-2 py-0.5 rounded-sm border ${
              vlog.processing_status === 'done' ? 'text-confirmed border-confirmed/30' :
              vlog.processing_status === 'error' ? 'text-disputed border-disputed/30' :
              'text-signal border-signal/30'
            }`}>pipeline: {vlog.processing_status}</span>
          )}
        </div>
      </div>
      <VlogPipeline vlog={vlog} />
    </div>
  )
}
