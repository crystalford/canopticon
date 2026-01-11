import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import LiquidChromeButton from '@/components/LiquidChromeButton'
import Navigation from '@/components/Navigation'
import { ArrowRight, Calendar } from 'lucide-react'

export default async function Home() {
  // Fetch latest published signal
  const { data: latestSignal } = await supabase
    .from('signals')
    .select('*')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(1)
    .single()

  return (
    <main className="min-h-screen bg-[#050505] text-white selection:bg-cyan-500/30">
      {/* Background Glows for Depth */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-900/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[10%] right-[-5%] w-[30%] h-[30%] bg-purple-900/10 blur-[100px] rounded-full" />
      </div>

      {/* Navigation */}
      <Navigation currentPage="home" />

      {/* Hero Section */}
      <section className="relative pt-44 pb-20 px-6 flex flex-col items-center justify-center text-center">
        {/* The "Crystal Ford" Glass Card */}
        <div className="max-w-4xl w-full p-12 rounded-[2.5rem] bg-white/[0.03] backdrop-blur-2xl border border-white/10 shadow-2xl relative overflow-hidden group">
          {/* Edge Highlight (Refraction) */}
          <div className="absolute inset-0 border border-white/10 rounded-[2.5rem] pointer-events-none group-hover:border-white/20 transition-colors" />
          
          <h1 className="text-6xl md:text-8xl font-bold tracking-tight mb-6 bg-gradient-to-b from-white to-gray-500 bg-clip-text text-transparent">
            CANOPTICON
          </h1>
          
          <p className="text-lg text-gray-400 max-w-xl mx-auto mb-10 leading-relaxed">
            An automated political signal engine. Monitoring parliamentary proceedings, votes, and institutional friction to surface meaningful shifts before they become news.
          </p>

          {/* Latest Signal Preview */}
          {latestSignal && (
            <div className="mb-10 p-6 rounded-2xl bg-white/[0.02] border border-white/5 text-left max-w-2xl mx-auto">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]"></div>
                <span className="text-xs text-gray-500 uppercase tracking-wider">Latest Signal</span>
              </div>
              <h3 className="text-xl font-bold mb-2">{latestSignal.headline || 'Untitled Signal'}</h3>
              {latestSignal.summary && (
                <p className="text-sm text-gray-400 mb-4 line-clamp-2">{latestSignal.summary}</p>
              )}
              <Link
                href={`/signal/${latestSignal.slug || latestSignal.id}`}
                className="inline-flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                Read full signal
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}

          {/* THE LIQUID CHROME BUTTON */}
          <LiquidChromeButton href="/signals" className="px-10 py-4">
            <span className="flex items-center gap-2">
              View All Signals
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-7-7 7 7-7 7"/></svg>
            </span>
          </LiquidChromeButton>
        </div>
      </section>
    </main>
  )
}