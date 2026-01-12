import { getGlobalSignals } from '@/lib/ingestion'
import Link from 'next/link'
import LiquidChromeButton from '@/components/LiquidChromeButton'
import Navigation from '@/components/Navigation'
import { ArrowRight, Globe, Zap, Radio } from 'lucide-react'
import SignalCard from '@/components/SignalCard'

export default async function Home() {
  // Fetch latest real signal (Server Side)
  const signals = await getGlobalSignals();
  // Filter for published only (simulate public view)
  // In a real app we'd filter at DB level, here we filter in memory
  const publishedSignals = signals.filter(s => s.status === 'published');

  // Latest 9
  const feed = publishedSignals.slice(0, 9);

  return (
    <main className="min-h-screen bg-[#050505] text-white selection:bg-cyan-500/30 pb-24">
      {/* Background Ambience */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-gradient-to-br from-purple-900/20 via-black to-cyan-900/20 blur-[130px] opacity-60" />
      </div>

      <Navigation currentPage="home" />

      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center px-4 text-center pt-32 mb-24">

        {/* Status Pill */}
        <div className="mb-8 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-cyan-400">
          <Zap className="w-3 h-3 fill-cyan-400" />
          <span>SYSTEM ONLINE: MONITORING CANADIAN PARLIAMENT</span>
        </div>

        <h1 className="text-6xl md:text-9xl font-bold tracking-tighter mb-8 bg-white bg-clip-text text-transparent opacity-90">
          CANOPTICON
        </h1>

        <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-12 leading-relaxed font-light">
          Real-time political signal detection. We trace the noise before it becomes the narrative.
        </p>

        {/* Primary CTA */}
        <div className="flex flex-col items-center gap-4">
          <LiquidChromeButton href="/admin/dashboard" className="px-12 py-5 text-lg">
            <span className="flex items-center gap-3">
              Enter Command
              <ArrowRight className="w-5 h-5" />
            </span>
          </LiquidChromeButton>
          <span className="text-xs text-gray-500 mt-4">Authorized access only</span>
        </div>
      </section>

      {/* Public Pulse Feed */}
      <section className="max-w-7xl mx-auto px-4">
        <div className="flex items-center gap-4 mb-8">
          <div className="h-px flex-1 bg-white/10"></div>
          <div className="flex items-center gap-2 text-cyan-400 font-mono text-sm tracking-widest">
            <Radio className="w-4 h-4 animate-pulse" />
            PUBLIC INTERCEPTS
          </div>
          <div className="h-px flex-1 bg-white/10"></div>
        </div>

        {feed.length === 0 ? (
          <div className="text-center py-24 text-gray-600">
            <p>No public signals currently broadcasting.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {feed.map(signal => (
              <div key={signal.id} className="relative">
                <SignalCard signal={signal} isAdmin={false} />
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}