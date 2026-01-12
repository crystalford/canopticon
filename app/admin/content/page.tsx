export const dynamic = 'force-dynamic'
export const revalidate = 0

import { supabaseAdmin } from '@/lib/supabase-admin'
import AdminNavigation from '@/components/AdminNavigation'
import { isUserAdmin } from '@/lib/auth'
import { redirect } from 'next/navigation'
import ContentTable from '@/components/ContentTable'

export default async function ContentPage({ searchParams }: { searchParams: { status?: string } }) {
    const isAdmin = await isUserAdmin();
    if (!isAdmin) redirect('/');

    const statusFilter = searchParams.status || 'all';

    // Fetch both drafts and published
    let query = supabaseAdmin
        .from('signals')
        .select('*, sources(name)')
        .order('created_at', { ascending: false });

    if (statusFilter === 'draft') {
        query = query.eq('status', 'draft');
    } else if (statusFilter === 'published') {
        query = query.eq('status', 'published');
    } else {
        // Show both draft and published
        query = query.in('status', ['draft', 'published']);
    }

    const { data: content } = await query;

    const draftCount = content?.filter(s => s.status === 'draft').length || 0;
    const publishedCount = content?.filter(s => s.status === 'published').length || 0;

    return (
        <main className="min-h-screen bg-[#050505] text-white">
            <AdminNavigation currentPage="content" />

            <div className="pt-24 pb-16 px-4 max-w-[1600px] mx-auto">
                {/* Header */}
                <header className="mb-8">
                    <h1 className="text-3xl font-bold mb-2">Content</h1>
                    <p className="text-gray-400">Manage drafts and published stories</p>
                </header>

                {/* Stats */}
                <div className="flex items-center gap-4 mb-6">
                    <a
                        href="/admin/content?status=all"
                        className={`px-4 py-2 rounded-lg transition-colors ${statusFilter === 'all' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                    >
                        All ({draftCount + publishedCount})
                    </a>
                    <a
                        href="/admin/content?status=draft"
                        className={`px-4 py-2 rounded-lg transition-colors ${statusFilter === 'draft' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                    >
                        🟡 Drafts ({draftCount})
                    </a>
                    <a
                        href="/admin/content?status=published"
                        className={`px-4 py-2 rounded-lg transition-colors ${statusFilter === 'published' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                    >
                        🟢 Published ({publishedCount})
                    </a>
                </div>

                {/* Content Table */}
                <ContentTable initialContent={content || []} />
            </div>
        </main>
    )
}
