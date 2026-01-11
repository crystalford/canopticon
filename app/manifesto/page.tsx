import Link from 'next/link'

export default function ManifestoPage() {
  return (
    <main className="min-h-screen bg-[#050505] text-white selection:bg-cyan-500/30">
      {/* Background Glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-900/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[10%] right-[-5%] w-[30%] h-[30%] bg-purple-900/10 blur-[100px] rounded-full" />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 flex justify-between items-center px-8 py-6 backdrop-blur-md border-b border-white/5 bg-black/20">
        <Link href="/" className="text-xl font-bold tracking-tighter uppercase hover:text-white transition-colors">Canopticon</Link>
        <div className="flex gap-8 text-sm font-medium text-gray-400">
          <Link href="/manifesto" className="hover:text-white transition-colors text-white">Manifesto</Link>
          <Link href="/signals" className="hover:text-white transition-colors">Signals</Link>
          <Link href="/archive" className="hover:text-white transition-colors">Archive</Link>
        </div>
      </nav>

      {/* Content */}
      <section className="relative pt-44 pb-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="p-12 rounded-3xl bg-white/[0.03] backdrop-blur-2xl border border-white/10 shadow-2xl">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 bg-gradient-to-b from-white to-gray-500 bg-clip-text text-transparent">
              The Digital Panopticon
            </h1>
            
            <div className="prose prose-invert prose-lg max-w-none space-y-6 text-gray-300 leading-relaxed">
              <p className="text-xl text-gray-400">
                Monitoring industrial transformation and the evolution of Canadian infrastructure. High-fidelity research for the modern era.
              </p>
              
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-white mt-8 mb-4">Our Mission</h2>
                <p>
                  Canopticon serves as a high-fidelity monitoring system for tracking the signals of industrial transformation across Canada. 
                  We aggregate, analyze, and present data on infrastructure evolution, policy shifts, and technological adoption patterns.
                </p>
                
                <h2 className="text-2xl font-bold text-white mt-8 mb-4">Methodology</h2>
                <p>
                  Our system processes signals from multiple sources—government announcements, industry reports, financial filings, 
                  and public discourse—to create a comprehensive view of systemic change. Each signal is verified, categorized, 
                  and contextualized within broader transformation narratives.
                </p>
                
                <h2 className="text-2xl font-bold text-white mt-8 mb-4">Transparency</h2>
                <p>
                  All signals are timestamped, sourced, and made available for public review. We believe that understanding 
                  the mechanisms of industrial transformation requires open access to high-quality data and analysis.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
