export const dynamic = 'force-dynamic'

import { supabaseAdmin } from '@/lib/supabase-admin'
import AdminNavigation from '@/components/AdminNavigation'
import { isUserAdmin } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Mic2, Film, Radio } from 'lucide-react'
import StudioItem from '@/components/StudioItem'

export default async function StudioPage() {
    const isAdmin = await isUserAdmin();
    if (!isAdmin) redirect('/');

    // Fetch 'approved' signals (waiting in Studio)
    // Ordered by newest approvals first
    const { data: approvedSignals } = await supabaseAdmin
        .from('signals')
        .select('*, sources(name)')
        .eq('status', 'approved') // Only APPROVED, not published yet
        .order('published_at', { ascending: false });

    return (
        <main className="min-h-screen bg-[#050505] text-white">
            <AdminNavigation currentPage="studio" />

            <div className="pt-24 pb-16 px-4 max-w-6xl mx-auto">
                <header className="mb-8 border-b border-white/10 pb-6 flex justify-between items-end">
                    <div>
                        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                            <Mic2 className="w-8 h-8 text-purple-400" />
                            Newsroom Studio
                        </h1>
                        <p className="text-gray-400">
                            Production floor. Turn approved signals into content and publish to the world.
                        </p>
                    </div>
                    <div className="flex gap-4 text-sm font-mono text-gray-500">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                            On Air
                        </div>
                    </div>
                </header>

                {approvedSignals && approvedSignals.length > 0 ? (
                    <div className="space-y-6">
                        {approvedSignals.map((signal: any) => (
                            <StudioItem key={signal.id} signal={signal} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-24 bg-white/[0.02] rounded-3xl border border-white/5 border-dashed">
                        <Film className="w-16 h-16 text-gray-700 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-gray-400 mb-2">Studio is Quiet</h2>
                        <p className="text-gray-500">
                            No approved signals waiting for production.
                            <br />
                            Go to <a href="/admin/review/pending" className="text-cyan-400 hover:underline">Review Queue</a> to approve stories.
                        </p>
                    </div>
                )}
            </div>
        </main>
    )
}
