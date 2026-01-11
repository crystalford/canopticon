import Navigation from '@/components/Navigation'

export default function ManifestoPage() {
  return (
    <main className="min-h-screen bg-[#050505] text-white selection:bg-cyan-500/30">
      {/* Background Glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-900/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[10%] right-[-5%] w-[30%] h-[30%] bg-purple-900/10 blur-[100px] rounded-full" />
      </div>

      {/* Navigation */}
      <Navigation currentPage="manifesto" />

      {/* Content */}
      <section className="relative pt-44 pb-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="p-12 rounded-3xl bg-white/[0.03] backdrop-blur-2xl border border-white/10 shadow-2xl">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 bg-gradient-to-b from-white to-gray-500 bg-clip-text text-transparent">
              Methodology
            </h1>
            
            <div className="prose prose-invert prose-lg max-w-none space-y-6 text-gray-300 leading-relaxed">
              <p className="text-xl text-gray-400">
                An automated political signal engine monitoring Canadian parliamentary proceedings, votes, and institutional friction.
              </p>
              
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-white mt-8 mb-4">What We Monitor</h2>
                  <p>
                    CANOPTICON continuously ingests institutional output from Parliament:
                  </p>
                  <ul className="list-disc list-inside space-y-2 mt-4 text-gray-300">
                    <li>House of Commons Hansard transcripts</li>
                    <li>Parliamentary votes and voting records</li>
                    <li>Committee proceedings and reports</li>
                    <li>Procedural motions and points of order</li>
                    <li>Public statements and institutional communications</li>
                  </ul>
                  <p className="mt-4">
                    Raw intake is immutable. Every source is timestamped, linked, and preserved as an historical record.
                  </p>
                </div>
                
                <div>
                  <h2 className="text-2xl font-bold text-white mt-8 mb-4">How Signals Are Generated</h2>
                  <p className="mb-4">
                    Signals are created automatically using deterministic detection rules. These rules identify patterns that indicate meaningful shifts:
                  </p>
                  
                  <div className="space-y-4 mt-6">
                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                      <h3 className="font-bold text-white mb-2">1. Cross-Speaker Phrase Repetition</h3>
                      <p className="text-sm text-gray-400">
                        When the same 5+ word phrase is used by 3+ different speakers in one day, it indicates coordinated messaging.
                      </p>
                    </div>
                    
                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                      <h3 className="font-bold text-white mb-2">2. Topic Spike vs Baseline</h3>
                      <p className="text-sm text-gray-400">
                        Topic keyword counts that exceed the rolling 14-day baseline by 2 standard deviations signal emerging focus areas.
                      </p>
                    </div>
                    
                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                      <h3 className="font-bold text-white mb-2">3. Procedural Friction Burst</h3>
                      <p className="text-sm text-gray-400">
                        High density of procedural terms (point of order, Speaker, adjournment) indicates institutional stress or conflict.
                      </p>
                    </div>
                    
                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                      <h3 className="font-bold text-white mb-2">4. Speech vs Vote Contradiction</h3>
                      <p className="text-sm text-gray-400">
                        When an MP&apos;s stated stance conflicts with their same-day vote record, it reveals strategic positioning.
                      </p>
                    </div>
                    
                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                      <h3 className="font-bold text-white mb-2">5. Delay Signal</h3>
                      <p className="text-sm text-gray-400">
                        Topics that appear repeatedly across days with no corresponding vote outcome suggest deferred action or deadlock.
                      </p>
                    </div>
                  </div>
                  
                  <p className="mt-6">
                    Each detected signal is assigned a confidence level (low, medium, high) and routed to either automated publishing or manual review.
                  </p>
                </div>
                
                <div>
                  <h2 className="text-2xl font-bold text-white mt-8 mb-4">What Silence Means</h2>
                  <p>
                    The absence of signals is also information. When expected topics or procedures don&apos;t generate signals within normal timeframes, 
                    it may indicate strategic delay, behind-the-scenes negotiation, or institutional gridlock. CANOPTICON tracks both presence and absence.
                  </p>
                </div>
                
                <div>
                  <h2 className="text-2xl font-bold text-white mt-8 mb-4">Publishing & Syndication</h2>
                  <p>
                    Every published signal has a permanent URL and includes source links, speaker attribution, and contextual metadata. 
                    Published signals are automatically distributed to social platforms (X, TikTok) with links back to the canonical source.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
