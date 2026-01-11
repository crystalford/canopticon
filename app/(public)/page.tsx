import { getGlobalSignals } from '@/lib/ingestion'
import Link from 'next/link'
import LiquidChromeButton from '@/components/LiquidChromeButton'
import Navigation from '@/components/Navigation'
import { ArrowRight, Globe, Zap } from 'lucide-react'

export default async function Home() {
  // Fetch latest real signal (Server Side)
  const signals = await getGlobalSignals();
  const latestSignal = signals.length > 0 ? signals[0] : null;

  return (
    <main className="min-h-screen bg-[#050505] text-white selection:bg-cyan-500/30">
      {/* Background Ambience */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-gradient-to-br from-purple-900/20 via-black to-cyan-900/20 blur-[130px] opacity-60" />
      </div>

      <Navigation currentPage="home" />

      {/* Hero */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4 text-center pt-32">

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
          <LiquidChromeButton href="/signals" className="px-12 py-5 text-lg">
            <span className="flex items-center gap-3">
              Access Feed
              <ArrowRight className="w-5 h-5" />
            </span>
          </LiquidChromeButton>
          <span className="text-xs text-gray-500 mt-4">Authorized access only</span>
        </div>

        {/* Latest Signal Ticker / Card */}
        {latestSignal && (
          <div className="mt-24 w-full max-w-3xl">
            <div className="p-1 rounded-3xl bg-gradient-to-r from-white/10 via-white/5 to-white/10">
              <div className="bg-black/90 backdrop-blur-xl rounded-[1.3rem] p-8 border border-white/5 flex flex-col md:flex-row items-start md:items-center gap-6 text-left hover:bg-white/[0.02] transition-colors">
                <div className="p-3 rounded-full bg-cyan-500/10 text-cyan-400">
                  <Globe className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="text-xs text-gray-500 mb-1 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                    LATEST INTERCEPT
                  </div>
                  <h3 className="text-lg font-medium text-white mb-1 line-clamp-1">{latestSignal.headline}</h3>
                  <p className="text-sm text-gray-400 line-clamp-1">{latestSignal.summary}</p>
                </div>
                <Link href={`/signals`} className="text-sm font-medium text-white underline decoration-white/30 hover:decoration-white transition-all underline-offset-4">
                  Analyze
                </Link>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}