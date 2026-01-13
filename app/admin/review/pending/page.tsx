import { supabaseAdmin } from '@/lib/supabase-admin'
import { isUserAdmin } from '@/lib/auth'
import AdminNavigation from '@/components/AdminNavigation'
import ReviewQueue from '@/components/ReviewQueue'
import RescueButton from '@/components/RescueButton'
import { redirect } from 'next/navigation'

export default async function ReviewPage() {
    const isAdmin = await isUserAdmin();
    if (!isAdmin) redirect('/');

    // Fetch pending signals
    // Sort by confidence_score if available (high confidence first for auto-approval check, or priority)
    // Logic: Oldest first? Newest first?
    // Let's do Newest first for speed, or Priority.
    const { data: signals, error } = await supabaseAdmin
        .from('signals')
        .select('*, sources(reliability_score, name, category)') // Join sources
        .eq('status', 'pending')
        .order('published_at', { ascending: false })
        .limit(100);

    if (error) {
        console.error("Failed to fetch pending signals:", error);
        return <div className="p-8 text-white">Error loading signals. Check logs.</div>
    }

    // Transform data to ensure source info is accessible (join flattening if needed, 
    // but Supabase JS client usually nests it as sources: { ... })

    return (
        <main className="min-h-screen bg-[#050505] text-white">
            <AdminNavigation currentPage="review" />

            <div className="pt-24 px-4 max-w-[1600px] mx-auto h-[calc(100vh_-_24px)] flex flex-col">
                <div className="mb-6 flex justify-between items-end">
                    <div>
                        <h1 className="text-2xl font-bold">Signal Review</h1>
                        <p className="text-gray-400 text-sm">Keyboard Shortcuts: [A] Approve, [R] Reject, [S] Skip</p>
                    </div>
                    <div className="flex gap-3 items-center">
                        <RescueButton />
                        <div className="bg-white/5 px-4 py-2 rounded-full text-sm font-mono text-cyan-400">
                            {signals?.length || 0} Pending
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden">
                    {/* Client Component for Interactive Triage */}
                    <ReviewQueue initialSignals={signals || []} />
                </div>

                {/* DEBUG SECTION - REMOVE AFTER FIX */}
                <div className="mt-8 p-4 bg-red-900/20 border border-red-500/30 rounded text-xs font-mono text-gray-300">
                    <h3 className="font-bold text-red-400 mb-2">DEBUG: Latest DB Entries</h3>
                    <DebugList />
                </div>
            </div>
        </main>
    )
}

async function DebugList() {
    // Fetch absolute latest signals regardless of status
    const { data: latest } = await supabaseAdmin
        .from('signals')
        .select('id, headline, status, created_at, source')
        .order('created_at', { ascending: false })
        .limit(5);

    if (!latest) return <div>No DB entries found</div>

    return (
        <div className="space-y-1">
            {latest.map(s => (
                <div key={s.id} className="flex gap-4">
                    <span className="text-cyan-400">[{s.status}]</span>
                    <span className="text-gray-500">{new Date(s.created_at).toLocaleTimeString()}</span>
                    <span className="truncate max-w-[300px]">{s.headline}</span>
                    <span className="text-gray-600">({s.source})</span>
                </div>
            ))}
        </div>
    )
}
