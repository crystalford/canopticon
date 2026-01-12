export const dynamic = 'force-dynamic'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { isUserAdmin } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import ArticleEditor from '@/components/ArticleEditor'

export default async function EditArticlePage({ params }: { params: { id: string } }) {
    const isAdmin = await isUserAdmin();
    if (!isAdmin) redirect('/');

    // Fetch the signal
    const { data: signal, error } = await supabaseAdmin
        .from('signals')
        .select('*, sources(name)')
        .eq('id', params.id)
        .single();

    if (error || !signal) {
        notFound();
    }

    return (
        <main className="min-h-screen bg-[#050505] text-white">
            <ArticleEditor signal={signal} />
        </main>
    );
}
