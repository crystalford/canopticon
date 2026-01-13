export const dynamic = 'force-dynamic'

import { supabaseAdmin } from '@/lib/supabase-admin'
import AdminNavigation from '@/components/AdminNavigation'
import { isUserAdmin } from '@/lib/auth'
import { redirect } from 'next/navigation'
import SourceTable from '@/components/SourceTable'
import ForceIngestButton from '@/components/ForceIngestButton'

export default async function SourcesPage() {
    const isAdmin = await isUserAdmin();
    if (!isAdmin) redirect('/');

    // Fetch all sources ordered by priority
    const { data: sources } = await supabaseAdmin
        .from('sources')
        .select('*')
        .order('priority', { ascending: true });

    const activeSources = sources?.filter((s: any) => s.active && !s.auto_disabled).length || 0;
    const warningSources = sources?.filter((s: any) => s.consecutive_failures > 0 && s.consecutive_failures < 5).length || 0;
    const disabledSources = sources?.filter((s: any) => s.auto_disabled || !s.active).length || 0;

    return (
        <main className="min-h-screen bg-[#050505] text-white">
            <AdminNavigation currentPage="sources" />

            <div className="pt-24 pb-16 px-4 max-w-[1600px] mx-auto">
                {/* Header */}
                <header className="mb-8 flex justify-between items-end">
                    <div>
                        <h1 className="text-3xl font-bold mb-2">Source Management</h1>
                        <p className="text-gray-400">
                            Control RSS feeds, article limits, and ingestion priority
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <AddSourceButton />
                        <ForceIngestButton />
                    </div>
                </header>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-center">
                        <p className="text-3xl font-bold text-green-400">{activeSources}</p>
                        <p className="text-sm text-gray-400">Active Sources</p>
                    </div>
                    <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-center">
                        <p className="text-3xl font-bold text-yellow-400">{warningSources}</p>
                        <p className="text-sm text-gray-400">Warnings</p>
                    </div>
                    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
                        <p className="text-3xl font-bold text-red-400">{disabledSources}</p>
                        <p className="text-sm text-gray-400">Disabled</p>
                    </div>
                </div>

                {/* Source Table */}
                <SourceTable sources={sources || []} />
            </div>
        </main>
    );
}
