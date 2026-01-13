import { supabaseAdmin } from '@/lib/supabase-admin'
import AdminNavigation from '@/components/AdminNavigation'
import { isUserAdmin } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Settings, Database, Zap, Bell, Key } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
    const isAdmin = await isUserAdmin();
    if (!isAdmin) redirect('/');

    // Fetch sources
    const { data: sources } = await supabaseAdmin
        .from('sources')
        .select('*')
        .order('priority', { ascending: false });

    // Fetch signal counts for stats
    const { count: totalSignals } = await supabaseAdmin
        .from('signals')
        .select('*', { count: 'exact', head: true });

    const { count: pendingSignals } = await supabaseAdmin
        .from('signals')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

    return (
        <main className="min-h-screen bg-[#050505] text-white">
            <AdminNavigation currentPage="settings" />

            <div className="pt-24 pb-16 px-4 max-w-5xl mx-auto">
                <header className="mb-10 border-b border-white/10 pb-6">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-white/5 rounded-xl">
                            <Settings className="w-6 h-6 text-cyan-400" />
                        </div>
                        <h1 className="text-3xl font-bold">Settings</h1>
                    </div>
                    <p className="text-gray-400">
                        Configure sources, auto-approval thresholds, and system preferences.
                    </p>
                </header>

                {/* Stats Overview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
                    <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10">
                        <div className="flex items-center gap-3 mb-2">
                            <Database className="w-5 h-5 text-cyan-400" />
                            <span className="text-sm text-gray-400">Total Signals</span>
                        </div>
                        <p className="text-3xl font-bold font-mono">{totalSignals || 0}</p>
                    </div>
                    <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10">
                        <div className="flex items-center gap-3 mb-2">
                            <Zap className="w-5 h-5 text-yellow-400" />
                            <span className="text-sm text-gray-400">Pending Review</span>
                        </div>
                        <p className="text-3xl font-bold font-mono">{pendingSignals || 0}</p>
                    </div>
                    <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10">
                        <div className="flex items-center gap-3 mb-2">
                            <Bell className="w-5 h-5 text-purple-400" />
                            <span className="text-sm text-gray-400">Active Sources</span>
                        </div>
                        <p className="text-3xl font-bold font-mono">{sources?.filter(s => s.active).length || 0}</p>
                    </div>
                </div>


                {/* Auto-Approval Settings */}
                <section className="mb-10 p-6 rounded-2xl bg-white/[0.03] border border-white/10">
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <Zap className="w-5 h-5 text-yellow-400" />
                        Auto-Approval Thresholds
                    </h2>
                    <p className="text-sm text-gray-400 mb-6">
                        Signals meeting these criteria are automatically approved to the archive.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm text-gray-400 mb-2">Confidence Threshold</label>
                            <div className="flex items-center gap-4">
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    defaultValue="75"
                                    className="flex-1 accent-cyan-500"
                                    disabled
                                />
                                <span className="text-lg font-mono text-cyan-400">75%</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Signals must score above this to auto-approve</p>
                        </div>

                        <div>
                            <label className="block text-sm text-gray-400 mb-2">Source Reliability</label>
                            <div className="flex items-center gap-4">
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    defaultValue="70"
                                    className="flex-1 accent-cyan-500"
                                    disabled
                                />
                                <span className="text-lg font-mono text-cyan-400">70%</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Source must have reliability above this</p>
                        </div>
                    </div>

                    <div className="mt-6 p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl">
                        <p className="text-sm text-yellow-400">
                            ⚠️ Threshold editing requires code changes in Phase 1.5
                        </p>
                    </div>
                </section>

                {/* API Configuration */}
                <section className="p-6 rounded-2xl bg-white/[0.03] border border-white/10">
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <Key className="w-5 h-5 text-green-400" />
                        API Configuration
                    </h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm text-gray-400 mb-2">OpenAI API Key</label>
                            <div className="flex gap-2">
                                <input
                                    type="password"
                                    value="sk-proj-••••••••••••••••••••••••"
                                    disabled
                                    className="flex-1 px-4 py-2 bg-black/40 border border-white/10 rounded-lg text-gray-500 font-mono text-sm"
                                />
                                <button className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-gray-400 transition-colors" disabled>
                                    Test
                                </button>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Configured via environment variable</p>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-green-500/5 border border-green-500/20 rounded-xl">
                            <div>
                                <p className="text-sm text-green-400 font-medium">Connection Status</p>
                                <p className="text-xs text-gray-400">OpenAI API is configured and active</p>
                            </div>
                            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                        </div>
                    </div>
                </section>
            </div>
        </main>
    )
}
