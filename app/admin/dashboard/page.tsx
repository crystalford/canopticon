export const dynamic = 'force-dynamic'

import { supabaseAdmin } from '@/lib/supabase-admin'
import AdminNavigation from '@/components/AdminNavigation'
import { isUserAdmin } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Radio, AlertCircle, ExternalLink, Activity, Video, Clock,
  CheckCircle, XCircle, ArrowRight, Zap
} from 'lucide-react'
import FlaggedSignalCard from '@/components/FlaggedSignalCard'
import BudgetTracker from '@/components/BudgetTracker'
import ForceIngestButton from '@/components/ForceIngestButton'

export default async function AdminDashboard() {
  const isAdmin = await isUserAdmin();
  if (!isAdmin) redirect('/');

  // Fetch all signals for stats
  const { data: signals } = await supabaseAdmin
    .from('signals')
    .select('id, status, created_at, confidence_score, headline, hash, source')
    .order('created_at', { ascending: false })
    .limit(500);

  // Fetch flagged signals (for video)
  const { data: flaggedSignals } = await supabaseAdmin
    .from('signals')
    .select('*, sources(name)')
    .eq('status', 'flagged')
    .order('created_at', { ascending: false })
    .limit(5);



  // Fetch recent published
  const { data: recentPublished } = await supabaseAdmin
    .from('signals')
    .select('*, sources(name)')
    .in('status', ['published', 'approved'])
    .order('created_at', { ascending: false })
    .limit(5);

  // Fetch source health
  const { data: sources } = await supabaseAdmin
    .from('sources')
    .select('id, name, active, consecutive_failures, auto_disabled, last_ingested_at')
    .order('priority', { ascending: false });

  // Calculate stats
  const total = signals?.length || 0;
  const pending = signals?.filter((s: any) => s.status === 'pending').length || 0;
  const flagged = signals?.filter((s: any) => s.status === 'flagged').length || 0;
  const published = signals?.filter((s: any) => ['published', 'approved'].includes(s.status)).length || 0;

  const activeSources = sources?.filter((s: any) => s.active && !s.auto_disabled).length || 0;
  const warningSources = sources?.filter((s: any) => s.consecutive_failures > 0 && s.consecutive_failures < 5).length || 0;
  const disabledSources = sources?.filter((s: any) => s.auto_disabled).length || 0;

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <AdminNavigation currentPage="dashboard" />

      <div className="pt-24 pb-16 px-4 max-w-[1600px] mx-auto">
        {/* Header */}
        <header className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold mb-2">Mission Control</h1>
            <p className="text-gray-400">Your morning command center. What needs attention today.</p>
          </div>
          <ForceIngestButton />
        </header>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
          <StatsCard label="Total Signals" value={total} icon={Radio} color="text-cyan-400" />
          <StatsCard label="Pending Review" value={pending} icon={Clock} color="text-yellow-400" alert={pending > 20} />
          <StatsCard label="Flagged for Video" value={flagged} icon={Video} color="text-purple-400" />
          <StatsCard label="Published" value={published} icon={CheckCircle} color="text-green-400" />
          <BudgetTracker monthlyLimit={50} />
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* FLAGGED FOR VIDEO - Priority Section */}
          <section className="lg:col-span-2 p-6 rounded-2xl bg-purple-500/5 border border-purple-500/20">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Video className="w-5 h-5 text-purple-400" />
                Flagged for Video ({flagged})
              </h2>
              <Link href="/admin/review/pending" className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1">
                View All <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {flaggedSignals && flaggedSignals.length > 0 ? (
              <div className="space-y-3">
                {flaggedSignals.map((signal: any) => (
                  <FlaggedSignalCard key={signal.id} signal={signal} />
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No signals flagged for video. Use [F] in Review to flag high-impact stories.</p>
            )}
          </section>



          {/* SOURCE HEALTH */}
          <section className="lg:col-span-2 p-6 rounded-2xl bg-white/[0.02] border border-white/10">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Activity className="w-5 h-5 text-green-400" />
                Source Health
              </h2>
              <Link href="/admin/settings" className="text-sm text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                Manage <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="text-center p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <p className="text-2xl font-bold text-green-400">{activeSources}</p>
                <p className="text-xs text-gray-400">Active</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <p className="text-2xl font-bold text-yellow-400">{warningSources}</p>
                <p className="text-xs text-gray-400">Warnings</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-2xl font-bold text-red-400">{disabledSources}</p>
                <p className="text-xs text-gray-400">Disabled</p>
              </div>
            </div>

            {sources?.filter((s: any) => s.consecutive_failures > 0).slice(0, 3).map((source: any) => (
              <div key={source.id} className="flex items-center gap-2 text-sm py-1 text-yellow-400">
                <AlertCircle className="w-4 h-4" />
                {source.name} - {source.consecutive_failures} failures
              </div>
            ))}
          </section>

          {/* RECENT PUBLICATIONS */}
          <section className="lg:col-span-2 p-6 rounded-2xl bg-white/[0.02] border border-white/10">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <ExternalLink className="w-5 h-5 text-cyan-400" />
                Recent Publications
              </h2>
              <Link href="/archive" className="text-sm text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                View Archive <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {recentPublished && recentPublished.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recentPublished.map((signal: any) => (
                  <Link
                    key={signal.id}
                    href={`/articles/${signal.hash || signal.id}`}
                    className="p-4 rounded-xl bg-black/20 border border-white/5 hover:border-cyan-500/30 transition-colors"
                  >
                    <h3 className="font-medium text-sm mb-2 line-clamp-2">{signal.headline}</h3>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{signal.sources?.name || signal.source}</span>
                      <span>{new Date(signal.created_at).toLocaleDateString()}</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No publications yet. Approve signals to publish.</p>
            )}
          </section>

        </div>
      </div>
    </main>
  )
}

function StatsCard({ label, value, icon: Icon, color, alert = false }: any) {
  return (
    <div className={`p-5 rounded-2xl border ${alert ? 'bg-red-500/10 border-red-500/30' : 'bg-white/[0.02] border-white/10'}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg bg-white/5 ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className="text-3xl font-bold font-mono">{value}</p>
      <p className="text-sm text-gray-400">{label}</p>
    </div>
  )
}