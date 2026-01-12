import Link from 'next/link'
import { ArrowRight, Play, Radio, Shield, Zap } from 'lucide-react'
import Navigation from '@/components/Navigation'
import { supabaseAdmin } from '@/lib/supabase-admin'
import LiquidChromeButton from '@/components/LiquidChromeButton'

export default async function PublicHomepage() {

  // Fetch Curated Signals (Status = 'published' or 'approved' with high priority/video)
  // For MVP, we treat 'approved' signals as the curated list for the homepage if they have high priority
  // or just show recent approved ones.
  const { data: featuredSignals } = await supabaseAdmin
    .from('signals')
    .select('*, sources(name)')
    .in('status', ['published', 'approved'])
    .order('confidence_score', { ascending: false }) // Show highest impact first
    .limit(3);

  const { data: recentSignals } = await supabaseAdmin
    .from('signals')
    .select('*, sources(name)')
    .in('status', ['published', 'approved'])
    .order('published_at', { ascending: false })
    .limit(6);

  return (
    <main className="min-h-screen bg-[#050505] text-white selection:bg-cyan-500/30">

      <Navigation currentPage="home" />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-8 overflow-hidden">
        {/* Abstract Background */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full opacity-30 pointer-events-none">
          <div className="absolute top-[20%] left-[20%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px]" />
          <div className="absolute bottom-[20%] right-[20%] w-[400px] h-[400px] bg-cyan-600/20 rounded-full blur-[100px]" />
        </div>

        <div className="max-w-7xl mx-auto relative z-10 text-center">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-gradient-to-br from-white via-white to-gray-500 bg-clip-text text-transparent">
            Clarity in the Chaos.
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Advanced political intelligence for the digital age.
            Tracking parliamentary signals and media narratives in real-time.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/archive">
              <LiquidChromeButton>
                Explore the Archive
              </LiquidChromeButton>
            </Link>
            <Link href="/about" className="px-6 py-3 rounded-full border border-white/10 hover:bg-white/5 transition-colors text-sm font-medium">
              How it works
            </Link>
          </div>
        </div>
      </section>

      {/* Featured / Hero Stories */}
      {featuredSignals && featuredSignals.length > 0 && (
        <section className="max-w-7xl mx-auto px-8 mb-24">
          <div className="flex items-end justify-between mb-8 border-b border-white/10 pb-4">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              High Impact Signals
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {featuredSignals.map((signal: any) => (
              <Link key={signal.id} href={`/archive`} className="group relative block h-full">
                {/* In real app, link to /articles/${signal.slug} */}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/80 z-10 rounded-3xl" />
                <div className="h-[400px] rounded-3xl bg-white/5 border border-white/10 overflow-hidden relative group-hover:border-white/20 transition-all">
                  {/* Placeholder for Image - in future use generated media */}
                  <div className="absolute inset-0 bg-gray-900 flex items-center justify-center text-gray-700">
                    <Radio className="w-12 h-12 opacity-20" />
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 p-8 z-20">
                    <div className="flex gap-2 mb-3">
                      <span className="text-xs font-mono bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded">
                        {/* @ts-ignore */}
                        {signal.sources?.name || signal.source}
                      </span>
                      <span className="text-xs font-mono bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded">
                        {Math.round(signal.confidence_score || 0)}% Impact
                      </span>
                    </div>
                    <h3 className="text-2xl font-bold leading-tight group-hover:underline decoration-cyan-500/50 underline-offset-4">
                      {signal.headline}
                    </h3>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Recent Feed Preview */}
      <section className="max-w-7xl mx-auto px-8 mb-24">
        <div className="flex items-end justify-between mb-8 border-b border-white/10 pb-4">
          <h2 className="text-xl font-bold flex items-center gap-2 text-gray-200">
            <Radio className="w-5 h-5 text-cyan-400" />
            Latest Intercepts
          </h2>
          <Link href="/archive" className="text-sm text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
            View Full Archive <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recentSignals?.map((signal: any) => (
            <Link key={signal.id} href={`/archive`} className="block p-6 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] hover:border-white/10 transition-colors">
              <div className="flex justify-between items-start mb-4">
                <span className="text-xs text-gray-500">{new Date(signal.published_at).toLocaleDateString()}</span>
                <Shield className="w-4 h-4 text-gray-700" />
              </div>
              <h3 className="text-lg font-semibold mb-2 line-clamp-2">{signal.headline}</h3>
              <p className="text-sm text-gray-400 line-clamp-3 mb-4">
                {signal.ai_summary || signal.summary}
              </p>
              <div className="text-xs font-mono text-cyan-400">
                {/* @ts-ignore */}
                via {signal.sources?.name || signal.source}
              </div>
            </Link>
          ))}
        </div>
      </section>

    </main>
  )
}