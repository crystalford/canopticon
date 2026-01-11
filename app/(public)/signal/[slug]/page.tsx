import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { ArrowLeft, Calendar, AlertCircle, ExternalLink } from 'lucide-react'
import Navigation from '@/components/Navigation'

interface PageProps {
  params: {
    slug: string
  }
}

export default async function SignalDetailPage({ params }: PageProps) {
  // Try to find signal by slug first, then by id
  const { data: signalBySlug } = await supabase
    .from('signals')
    .select('*')
    .eq('slug', params.slug)
    .single()

  const { data: signalById } = await supabase
    .from('signals')
    .select('*')
    .eq('id', params.slug)
    .single()

  const signal = signalBySlug || signalById

  if (!signal) {
    notFound()
  }

  const statusColors = {
    draft: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    published: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    archived: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white selection:bg-cyan-500/30">
      {/* Background Glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-900/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[10%] right-[-5%] w-[30%] h-[30%] bg-purple-900/10 blur-[100px] rounded-full" />
      </div>

      {/* Navigation */}
      <Navigation currentPage="signals" />

      {/* Content */}
      <section className="relative pt-44 pb-20 px-6">
        <div className="max-w-4xl mx-auto">
          <Link
            href="/signals"
            className="inline-flex items-center gap-2 mb-8 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Signals
          </Link>

          {/* Signal Header Card */}
          <div className="p-8 rounded-3xl bg-white/[0.03] backdrop-blur-2xl border border-white/10 shadow-2xl mb-6">
            <div className="flex items-start justify-between mb-6">
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-gradient-to-b from-white to-gray-500 bg-clip-text text-transparent flex-1">
                {signal.headline || 'Untitled Signal'}
              </h1>
              <span className={`px-3 py-1 rounded text-xs font-mono border ml-4 ${statusColors[signal.status as keyof typeof statusColors] || statusColors.draft}`}>
                {signal.status}
              </span>
            </div>
            
            <div className="flex flex-wrap gap-4 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>{new Date(signal.created_at).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}</span>
              </div>
              {signal.source && (
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>Source: {signal.source}</span>
                </div>
              )}
            </div>
          </div>

          {/* Signal Content */}
          {signal.summary && (
            <div className="p-8 rounded-3xl bg-white/[0.03] backdrop-blur-xl border border-white/10 shadow-xl mb-6">
              <h2 className="text-xl font-bold mb-4">Summary</h2>
              <div className="prose prose-invert prose-lg max-w-none text-gray-300 leading-relaxed">
                <p>{signal.summary}</p>
              </div>
            </div>
          )}

          {/* Signal Body Content */}
          {signal.body && (
            <div className="p-8 rounded-3xl bg-white/[0.03] backdrop-blur-xl border border-white/10 shadow-xl mb-6">
              <h2 className="text-xl font-bold mb-4">Details</h2>
              <div className="prose prose-invert prose-lg max-w-none text-gray-300 leading-relaxed whitespace-pre-wrap">
                {signal.body}
              </div>
            </div>
          )}

          {/* Metadata */}
          {signal.metadata && typeof signal.metadata === 'object' && Object.keys(signal.metadata).length > 0 && (
            <div className="p-8 rounded-3xl bg-white/[0.03] backdrop-blur-xl border border-white/10 shadow-xl mb-6">
              <h2 className="text-xl font-bold mb-4">Metadata</h2>
              <pre className="text-xs text-gray-400 overflow-x-auto bg-black/20 p-4 rounded-lg border border-white/5">
                {JSON.stringify(signal.metadata, null, 2)}
              </pre>
            </div>
          )}

          {/* Signal ID Footer */}
          <div className="text-xs text-gray-500 text-center pt-6">
            Signal ID: {signal.id} {signal.slug && `| Slug: ${signal.slug}`}
          </div>
        </div>
      </section>
    </main>
  )
}
