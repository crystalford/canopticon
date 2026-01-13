import AdminNavigation from '@/components/AdminNavigation'
import TrendStream from '@/components/TrendStream'

export const dynamic = 'force-dynamic'

export default function TrendsPage() {
    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-cyan-500/30">
            <AdminNavigation currentPage="trends" />

            <main className="pl-64">
                <div className="max-w-7xl mx-auto p-8">
                    <header className="mb-8">
                        <h1 className="text-4xl font-black mb-2 tracking-tight">Social Monitoring</h1>
                        <p className="text-gray-400">Real-time pulse of global political discourse.</p>
                    </header>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Main Feed */}
                        <div className="lg:col-span-2">
                            <TrendStream />
                        </div>

                        {/* Sidebar / Stats */}
                        <div className="space-y-6">
                            <div className="bg-white/5 border border-white/10 p-6 rounded-xl">
                                <h3 className="font-bold text-gray-300 mb-4">Active Connectors</h3>
                                <div className="flex items-center gap-3 text-sm text-green-400">
                                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                    Twitter/X API (Mock Mode)
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}
