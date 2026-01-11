import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Activity, Inbox, Zap, CheckCircle2, ArrowRight } from 'lucide-react'
import LiquidChromeButton from '@/components/LiquidChromeButton'

export default async function MissionControlDashboard() {
  // Fetch Real Data from Supabase
  const { data: signals } = await supabase
    .from('signals')
    .select('*')
    .order('created_at', { ascending: false })

  const { data: intakeLogs } = await supabase
    .from('intake_logs')
    .select('*')
    .order('created_at', { ascending: false })

  // Handle empty data
  const safeSignals = signals || []
  const safeLogs = intakeLogs || []

  // Filter data
  const pendingSignals = safeSignals.filter((s) => s.status === 'draft')
  const publishedSignals = safeSignals.filter((s) => s.status === 'published')
  const recentLogs = safeLogs.slice(0, 10)

  return (
    <main className="min-h-screen bg-[#050505] text-white p-8 selection:bg-cyan-500/30">
      {/* Background Depth */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-900/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[30%] h-[30%] bg-cyan-900/10 blur-[100px] rounded-full" />
      </div>

      <header className="max-w-7xl mx-auto mb-12 flex justify-between items-end relative z-10">
        <div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-white to-gray-500 bg-clip-text text-transparent">
            Signal Command
          </h1>
          <p className="text-gray-400 mt-2">Monitoring industrial and infrastructure shifts.</p>
        </div>
        
        {/* Liquid Chrome Button */}
        <LiquidChromeButton>
          Export Report
        </LiquidChromeButton>
      </header>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-6 mb-12 relative z-10">
        {[
          { label: "Total Signals", value: safeSignals.length.toString(), trend: `${publishedSignals.length} published`, color: "text-cyan-400" },
          { label: "Draft Queue", value: pendingSignals.length.toString(), trend: "Pending review", color: "text-yellow-400" },
          { label: "Published", value: publishedSignals.length.toString(), trend: "Live", color: "text-green-400" },
          { label: "Intake Logs", value: safeLogs.length.toString(), trend: "Active", color: "text-purple-400" }
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

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 relative z-10">
        {/* Live Signal Feed */}
        <section className="lg:col-span-1 rounded-3xl bg-white/[0.03] backdrop-blur-xl border border-white/10 overflow-hidden shadow-2xl">
          <div className="p-6 border-b border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              <h2 className="font-semibold text-lg">Live Signal Feed</h2>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="divide-y divide-white/5">
              {safeSignals.length === 0 ? (
                <div className="p-6 text-sm text-gray-500 italic">Waiting for signals...</div>
              ) : (
                safeSignals.slice(0, 8).map((signal) => (
                  <div key={signal.id} className="group hover:bg-white/[0.02] transition-colors p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium mb-1 truncate">{signal.headline || 'Untitled Signal'}</h3>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full ${signal.status === 'published' ? 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]' : 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]'}`} />
                            {signal.status}
                          </span>
                          <span>{new Date(signal.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <Link 
                        href={`/signal/${signal.slug || signal.id}`}
                        className="text-xs text-gray-500 hover:text-white transition-colors flex items-center gap-1"
                      >
                        View
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* Intake Log */}
        <section className="lg:col-span-1 rounded-3xl bg-white/[0.03] backdrop-blur-xl border border-white/10 overflow-hidden shadow-2xl">
          <div className="p-6 border-b border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <div className="relative">
                <span className="absolute -top-1 -right-1 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                </span>
                <Inbox className="w-5 h-5" />
              </div>
              <h2 className="font-semibold text-lg">Intake Log</h2>
            </div>
          </div>
          <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto">
            {recentLogs.length === 0 ? (
              <div className="p-6 text-sm text-gray-500 italic">No logs detected yet...</div>
            ) : (
              recentLogs.map((log) => (
                <div key={log.id} className="p-6 group hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{log.source || 'Unknown Source'}</span>
                        <span className="text-xs text-gray-500">
                          {new Date(log.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">{log.summary || 'No summary available'}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* System Status */}
      <div className="max-w-7xl mx-auto mt-6 relative z-10">
        <div className="p-6 rounded-3xl bg-white/[0.03] backdrop-blur-xl border border-white/10">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(6,182,212,0.5)]"></div>
              <span className="text-sm text-gray-400">Supabase Connection: ACTIVE</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
              <span className="text-sm text-gray-400">Live Monitoring: ON</span>
            </div>
            <div className="text-xs text-gray-500 ml-auto">
              Automated actions enabled via n8n pipeline
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}