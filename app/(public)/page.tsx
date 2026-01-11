import { CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { mockSignals } from '@/lib/mockData'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#22c55e] font-mono">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* System Status */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle2 className="w-6 h-6 text-[#22c55e] animate-pulse" />
            <h1 className="text-3xl font-bold">SYSTEM ONLINE</h1>
          </div>
          <div className="text-sm text-[#22c55e]/70">
            <p className="mb-2">$ canopticon --status</p>
            <p className="ml-4">[OK] All systems operational</p>
            <p className="ml-4">[OK] Signal processing active</p>
            <p className="ml-4">[OK] Database connection established</p>
          </div>
        </div>

        {/* Terminal-style content */}
        <div className="space-y-6">
          <div className="border border-[#22c55e]/30 p-6 bg-[#0a0a0a]">
            <p className="text-sm mb-4">$ canopticon --info</p>
            <div className="space-y-2 text-sm text-[#22c55e]/80">
              <p>CANOPTICON v1.0.0</p>
              <p>Signal Monitoring and Analysis System</p>
              <p>Active Signals: {mockSignals.length}</p>
              <p>Last Update: {new Date().toLocaleTimeString()}</p>
            </div>
          </div>

          {/* Recent Signals Preview */}
          <div className="border border-[#22c55e]/30 p-6 bg-[#0a0a0a]">
            <p className="text-sm mb-4">$ canopticon --signals --recent</p>
            <div className="space-y-3">
              {mockSignals.slice(0, 3).map((signal) => (
                <div key={signal.id} className="text-sm">
                  <Link
                    href={`/signal/${signal.slug}`}
                    className="hover:text-[#22c55e] transition-colors"
                  >
                    <span className="text-[#22c55e]/60">[{signal.priority.toUpperCase()}]</span>{' '}
                    <span className="text-[#22c55e]">{signal.title}</span>
                    <span className="text-[#22c55e]/50 ml-2">- {signal.source}</span>
                  </Link>
                </div>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex gap-4">
            <Link
              href="/admin/dashboard"
              className="px-6 py-3 border border-[#22c55e] text-[#22c55e] hover:bg-[#22c55e] hover:text-[#0a0a0a] transition-colors font-mono text-sm"
            >
              ACCESS MISSION CONTROL
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
