import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { ArgumentMap } from '@/types/database'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import ArgumentMapEditor from './ArgumentMapEditor'

export const dynamic = 'force-dynamic'

export default async function ArgumentMapDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: map } = await supabase
    .from('argument_maps')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!map) notFound()

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/argument-maps" className="text-text-muted hover:text-text-secondary transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs px-2 py-0.5 rounded-sm border text-hypothesis border-hypothesis/30 bg-hypothesis/5">
            {(map as ArgumentMap).article_type.replace('_', ' ')}
          </span>
          <span className={`font-mono text-xs px-2 py-0.5 rounded-sm border ${
            map.status === 'published'
              ? 'text-confirmed border-confirmed/30 bg-confirmed/10'
              : 'text-text-muted border-border bg-raised'
          }`}>{map.status}</span>
          <span className="font-mono text-xs text-text-muted">
            Updated {new Date((map as ArgumentMap).updated_at).toLocaleDateString('en-CA')}
          </span>
        </div>
      </div>
      <ArgumentMapEditor map={map as ArgumentMap} />
    </div>
  )
}
