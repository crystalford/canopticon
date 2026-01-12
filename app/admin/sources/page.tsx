import { supabase } from '@/lib/supabase'
import Navigation from '@/components/Navigation'
import SourceManager from '@/components/SourceManager'

export const dynamic = 'force-dynamic'

export default async function SourcesPage() {
    const { data: sources } = await supabase
        .from('sources')
        .select('*')
        .order('created_at', { ascending: false });

    return (
        <main className="min-h-screen bg-[#050505] text-white">
            <Navigation currentPage="sources" />
            <div className="pt-24 p-8 max-w-4xl mx-auto">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold tracking-tight">Ingest Control Room</h1>
                    <p className="text-gray-400 mt-2">Manage RSS feeds and API sources.</p>
                </header>

                <SourceManager initialSources={sources || []} />
            </div>
        </main>
    )
}
