import { supabase } from '@/lib/supabase'
import { Activity, Inbox, Zap, CheckCircle2, XCircle, Clock } from 'lucide-react'

// We make this an async function so it can fetch data before loading
export default async function MissionControlDashboard() {
  
  // 1. Fetch Real Data from Supabase
  const { data: signals } = await supabase
    .from('signals')
    .select('*')
    .order('created_at', { ascending: false })

  const { data: intakeLogs } = await supabase
    .from('intake_logs')
    .select('*')
    .order('created_at', { ascending: false })

  // 2. Handle empty data (prevent crashes if DB is empty)
  const safeSignals = signals || []
  const safeLogs = intakeLogs || []

  // 3. Filter data using real DB status fields
  const pendingSignals = safeSignals.filter((s) => s.status === 'draft')
  const publishedSignals = safeSignals.filter((s) => s.status === 'published')
  const recentLogs = safeLogs.slice(0, 5)

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#22c55e] font-mono">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Dashboard Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Activity className="w-8 h-8" />
            <h1 className="text-4xl font-bold">MISSION CONTROL</h1>
          </div>
          <p className="text-sm text-[#22c55e]/70">
            $ canopticon --dashboard --admin --live
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="border border-[#22c55e]/30 p-4 bg-[#0a0a0a]">
            <div className="text-sm text-[#22c55e]/70 mb-1">Total Signals</div>
            <div className="text-2xl font-bold">{safeSignals.length}</div>
          </div>
          <div className="border border-[#22c55e]/30 p-4 bg-[#0a0a0a]">
            <div className="text-sm text-[#22c55e]/70 mb-1">Drafts</div>
            <div className="text-2xl font-bold text-yellow-500">{pendingSignals.length}</div>
          </div>
          <div className="border border-[#22c55e]/30 p-4 bg-[#0a0a0a]">
            <div className="text-sm text-[#22c55e]/70 mb-1">Published</div>
            <div className="text-2xl font-bold text-blue-500">{publishedSignals.length}</div>
          </div>
          <div className="border border-[#22c55e]/30 p-4 bg-[#0a0a0a]">
            <div className="text-sm text-[#22c55e]/70 mb-1">Intake Logs</div>
            <div className="text-2xl font-bold">{safeLogs.length}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Intake Log Section */}
          <div className="lg:col-span-1">
            <div className="border border-[#22c55e]/30 p-6 bg-[#0a0a0a]">
              <div className="flex items-center gap-2 mb-4">
                <div className="relative">
                    <span className="absolute -top-1 -right-1 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22c55e] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22c55e]"></span>
                    </span>
                    <Inbox className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold">INTAKE LOG</h2>
              </div>
              <div className="space-y-3">
                {recentLogs.length === 0 ? (
                    <div className="text-xs text-[#22c55e]/50 italic">No logs detected yet...</div>
                ) : (
                    recentLogs.map((log) => (
                    <div
                        key={log.id}
                        className="border-l-2 border-[#22c55e]/30 pl-3 py-2 text-sm"
                    >
                        <div className="flex items-center gap-2 mb-1">
                        <CheckCircle2 className="w-4 h-4 text-[#22c55e]" />
                        <span className="font-bold">{log.source}</span>
                        <span className="text-[#22c55e]/50 text-xs">
                            {new Date(log.created_at).toLocaleTimeString()}
                        </span>
                        </div>
                        <div className="text-xs text-[#22c55e]/70">
                        {log.summary}
                        </div>
                    </div>
                    ))
                )}
              </div>
            </div>
          </div>

          {/* Signals Queue Section */}
          <div className="lg:col-span-1">
            <div className="border border-[#22c55e]/30 p-6 bg-[#0a0a0a]">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-5 h-5" />
                <h2 className="text-xl font-bold">SIGNALS QUEUE</h2>
              </div>
              <div className="space-y-3">
                {safeSignals.length === 0 ? (
                    <div className="text-xs text-[#22c55e]/50 italic">Waiting for signals...</div>
                ) : (
                    safeSignals.map((signal) => (
                    <div
                        key={signal.id}
                        className={`border-l-2 ${signal.status === 'published' ? 'border-blue-500' : 'border-yellow-500'} pl-3 py-2 text-sm`}
                    >
                        <div className="flex items-center justify-between mb-1">
                        <span className="font-bold truncate pr-2">{signal.headline}</span>
                        <span className="text-xs text-[#22c55e]/50">{signal.status}</span>
                        </div>
                        <div className="text-xs text-[#22c55e]/70">
                        {new Date(signal.created_at).toLocaleTimeString()}
                        </div>
                    </div>
                    ))
                )}
              </div>
            </div>
          </div>

          {/* Action Panel Section */}
          <div className="lg:col-span-1">
            <div className="border border-[#22c55e]/30 p-6 bg-[#0a0a0a]">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-5 h-5" />
                <h2 className="text-xl font-bold">ACTION PANEL</h2>
              </div>
              <div className="space-y-3">
                <button className="w-full px-4 py-2 border border-[#22c55e] text-[#22c55e] hover:bg-[#22c55e] hover:text-[#0a0a0a] transition-colors text-sm font-mono">
                  REFRESH DATA
                </button>
                <div className="text-xs text-[#22c55e]/50 text-center pt-2">
                    Automated actions enabled via n8n pipeline.
                </div>
              </div>
              <div className="mt-6 pt-6 border-t border-[#22c55e]/20">
                <p className="text-xs text-[#22c55e]/70 mb-2">System Status:</p>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-[#22c55e] rounded-full animate-pulse"></div>
                    <span>Supabase Connection: ACTIVE</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-[#22c55e] rounded-full animate-pulse"></div>
                    <span>Live Monitoring: ON</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}