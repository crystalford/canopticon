import Link from 'next/link'
import { Activity, Inbox, Zap, CheckCircle2, ArrowRight, ExternalLink } from 'lucide-react'
import LiquidChromeButton from '@/components/LiquidChromeButton'
import Navigation from '@/components/Navigation'
import { getGlobalSignals } from '@/lib/ingestion'
import SignalCard from '@/components/SignalCard'
import WireSignal from '@/components/WireSignal'

export default async function MissionControlDashboard() {
  // Fetch Real Data (Server-Side)
  // Aggregates RSS + Parliament Data
  const signals = await getGlobalSignals();

  const recentLogs = [
    { id: '1', source: 'System', itemsCount: signals.length, status: 'success', timestamp: new Date().toISOString() }
  ];

  const pendingSignals = signals.filter((s) => s.status === 'pending');
  const publishedSignals = signals.filter((s) => s.status === 'published');

  return (
    <main className="min-h-screen bg-[#050505] text-white selection:bg-cyan-500/30">
      {/* Background Depth */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-900/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[30%] h-[30%] bg-cyan-900/10 blur-[100px] rounded-full" />
      </div>

      {/* Navigation */}
      <Navigation currentPage="dashboard" />

      <div className="pt-24 p-8">
        <header className="max-w-7xl mx-auto mb-12 flex justify-between items-end relative z-10">
          <div>
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-white to-gray-500 bg-clip-text text-transparent">
              Signal Command
            </h1>
            <p className="text-gray-400 mt-2">Monitoring Canadian political landscape.</p>
          </div>

          {/* Liquid Chrome Button */}
          <LiquidChromeButton>
            Force Ingest
          </LiquidChromeButton>
        </header>

        {/* Stats Cards */}
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-6 mb-12 relative z-10">
          {[
            { label: "Active Signals", value: signals.length.toString(), trend: "Live Feed", color: "text-cyan-400" },
            { label: "Draft Queue", value: pendingSignals.length.toString(), trend: "Pending review", color: "text-yellow-400" },
            { label: "Published", value: publishedSignals.length.toString(), trend: "Live", color: "text-green-400" },
            { label: "Sources", value: "3", trend: "CBC, Global, CTV", color: "text-purple-400" }
          ].map((stat, i) => (
            <div key={i} className="p-6 rounded-3xl bg-white/[0.03] backdrop-blur-xl border border-white/10 shadow-xl hover:border-white/20 transition-colors">
              <p className="text-sm text-gray-500 font-medium mb-1">{stat.label}</p>
              <div className="flex justify-between items-baseline">
                <h3 className="text-3xl font-bold">{stat.value}</h3>
                <span className={`text-xs font-mono ${stat.color}`}>{stat.trend}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">

          {/* THE WIRE (Triage) - 30% width */}
          <section className="lg:col-span-4 rounded-3xl bg-white/[0.03] backdrop-blur-xl border border-white/10 overflow-hidden shadow-2xl flex flex-col h-[800px]">
            <div className="p-4 border-b border-white/10 bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <span className="absolute -top-1 -right-1 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                  <Inbox className="w-4 h-4 text-gray-400" />
                </div>
                <h2 className="font-semibold text-sm uppercase tracking-wider text-gray-400">The Wire</h2>
                <span className="ml-auto text-xs bg-white/10 px-2 py-0.5 rounded-full">{pendingSignals.length}</span>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 custom-scrollbar">
              {pendingSignals.length === 0 ? (
                <div className="p-6 text-sm text-gray-500 italic text-center">No new signals on the wire.</div>
              ) : (
                <div>
                  {pendingSignals.map((signal) => (
                    <WireSignal key={signal.id} signal={signal} />
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* EDITORIAL DESK (Production) - 70% width */}
          <section className="lg:col-span-8 rounded-3xl bg-white/[0.03] backdrop-blur-xl border border-white/10 overflow-hidden shadow-2xl flex flex-col h-[800px]">
            <div className="p-4 border-b border-white/10 bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-cyan-400" />
                <h2 className="font-semibold text-sm uppercase tracking-wider text-gray-400">Editorial Desk</h2>
                <span className="ml-auto text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full">{signals.filter(s => s.status === 'processing').length} Active</span>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 custom-scrollbar p-0">
              {signals.filter(s => s.status === 'processing').length === 0 ? (
                <div className="p-12 text-center">
                  <div className="inline-flex justify-center items-center w-16 h-16 rounded-full bg-white/5 mb-4">
                    <CheckCircle2 className="w-8 h-8 text-gray-600" />
                  </div>
                  <p className="text-gray-500">Editorial desk is clear.</p>
                  <p className="text-xs text-gray-600 mt-1">Approve signals from the wire to begin production.</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {signals.filter(s => s.status === 'processing').map((signal) => (
                    <SignalCard key={signal.id} signal={signal} isAdmin={true} />
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* System Status */}
        <div className="max-w-7xl mx-auto mt-6 relative z-10">
          <div className="p-6 rounded-3xl bg-white/[0.03] backdrop-blur-xl border border-white/10">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                {/* No DB for now, just Live */}
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(234,179,8,0.5)]"></div>
                <span className="text-sm text-gray-400">Database: BYPASSED (Live Mode)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
                <span className="text-sm text-gray-400">Live Ingestion: ACTIVE</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}