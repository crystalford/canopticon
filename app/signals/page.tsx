import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { ArrowRight, Calendar, Zap } from 'lucide-react'
import Navigation from '@/components/Navigation'

export default async function SignalsPage() {
  // Fetch published signals from Supabase
  const { data: signals } = await supabase
    .from('signals')
    .select('*')
    .eq('status', 'published')
    .order('created_at', { ascending: false })

  const safeSignals = signals || []

  return (
    <main className="min-h-screen bg-[#050505] text-white selection:bg-cyan-500/30">
      {/* Background Glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-900/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[10%] right-[-5%] w-[30%] h-[30%] bg-purple-900/10 blur-[100px] rounded-full" />
      </div>

      {/* Navigation */}
      <Navigation currentPage="signals" />

      {/* Hero Section */}
      <section className="relative pt-44 pb-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-12">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-4 bg-gradient-to-b from-white to-gray-500 bg-clip-text text-transparent">
              Signal Archive
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl">
              High-fidelity monitoring of industrial transformation and Canadian infrastructure evolution.
            </p>
          </div>

          {/* Signals Grid */}
          {safeSignals.length === 0 ? (
            <div className="p-12 rounded-3xl bg-white/[0.03] backdrop-blur-xl border border-white/10 text-center">
              <Zap className="w-12 h-12 mx-auto mb-4 text-gray-500" />
              <p className="text-gray-400">No signals published yet. Check back soon.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {safeSignals.map((signal) => (
                <Link
                  key={signal.id}
                  href={`/signal/${signal.slug || signal.id}`}
                  className="group p-6 rounded-3xl bg-white/[0.03] backdrop-blur-xl border border-white/10 hover:border-white/20 hover:bg-white/[0.05] transition-all shadow-xl"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]"></div>
                      <span className="text-xs text-gray-500 uppercase tracking-wider">Signal</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
                  </div>
                  <h2 className="text-xl font-bold mb-3 group-hover:text-cyan-400 transition-colors">
                    {signal.headline || 'Untitled Signal'}
                  </h2>
                  {signal.summary && (
                    <p className="text-sm text-gray-400 mb-4 line-clamp-3">{signal.summary}</p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Calendar className="w-3 h-3" />
                    <span>{new Date(signal.created_at).toLocaleDateString()}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
