import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Archive, Calendar, ArrowRight } from 'lucide-react'
import Navigation from '@/components/Navigation'

export default async function ArchivePage() {
  // Fetch all signals (including archived ones)
  const { data: signals } = await supabase
    .from('signals')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  const safeSignals = signals || []

  return (
    <main className="min-h-screen bg-[#050505] text-white selection:bg-cyan-500/30">
      {/* Background Glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-900/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[10%] right-[-5%] w-[30%] h-[30%] bg-purple-900/10 blur-[100px] rounded-full" />
      </div>

      {/* Navigation */}
      <Navigation currentPage="archive" />

      {/* Content */}
      <section className="relative pt-44 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <Archive className="w-8 h-8" />
              <h1 className="text-5xl md:text-7xl font-bold tracking-tight bg-gradient-to-b from-white to-gray-500 bg-clip-text text-transparent">
                Archive
              </h1>
            </div>
            <p className="text-lg text-gray-400 max-w-2xl">
              Complete historical record of all signals processed by the system.
            </p>
          </div>

          {/* Archive Table */}
          <div className="rounded-3xl bg-white/[0.03] backdrop-blur-xl border border-white/10 overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-white/10 bg-white/[0.02]">
              <h2 className="font-semibold text-lg">Signal Archive</h2>
            </div>
            <div className="overflow-x-auto">
              <div className="divide-y divide-white/5">
                {safeSignals.length === 0 ? (
                  <div className="p-12 text-center text-gray-500">
                    <Archive className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No signals archived yet.</p>
                  </div>
                ) : (
                  safeSignals.map((signal) => (
                    <Link
                      key={signal.id}
                      href={`/signal/${signal.slug || signal.id}`}
                      className="group block p-6 hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-medium text-lg group-hover:text-cyan-400 transition-colors">
                              {signal.headline || 'Untitled Signal'}
                            </h3>
                            <span className={`px-2 py-1 rounded text-xs font-mono ${
                              signal.status === 'published' 
                                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' 
                                : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                            }`}>
                              {signal.status}
                            </span>
                          </div>
                          {signal.summary && (
                            <p className="text-sm text-gray-400 mb-3 line-clamp-2">{signal.summary}</p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(signal.created_at).toLocaleDateString()}
                            </span>
                            {signal.source && (
                              <span>Source: {signal.source}</span>
                            )}
                          </div>
                        </div>
                        <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-white group-hover:translate-x-1 transition-all flex-shrink-0" />
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
