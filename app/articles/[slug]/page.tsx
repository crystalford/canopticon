import { supabaseAdmin } from '@/lib/supabase-admin'
import Navigation from '@/components/Navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

// export async function generateStaticParams() {
//   // Optional: SSG for top articles
//   return [] 
// }

export default async function ArticlePage({
    params,
    searchParams
}: {
    params: { slug: string }
    searchParams: { preview?: string }
}) {
    const { slug } = params;
    const isPreview = searchParams.preview === 'true';

    // Try to find article
    const { data: article } = await supabaseAdmin
        .from('articles')
        .select('*, video_materials(*)')
        .eq('slug', slug)
        .single();

    // Fallback: Try treating slug as signal hash/ID
    let signal = null;
    if (!article) {
        const { data: signalData } = await supabaseAdmin
            .from('signals')
            .select('*, sources(name)')
            .or(`hash.eq.${slug},id.eq.${slug}`)
            .single();

        signal = signalData;

        // If not found in signals either, 404
        if (!signal) notFound();
    }

    const content = article || signal;

    // If we have a signal but no article, render the signal view
    if (signal && !article) {
        return (
            <main className="min-h-screen bg-[#050505] text-white">
                <Navigation currentPage="archive" />
                <div className="pt-32 px-4 max-w-3xl mx-auto">
                    <Link href="/archive" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-white mb-8 transition-colors">
                        <ArrowLeft className="w-4 h-4" /> Back to Archive
                    </Link>
                    <h1 className="text-4xl font-bold mb-6">{signal.headline}</h1>
                    <div className="prose prose-invert max-w-none">
                        <p className="lead text-xl text-gray-300">{signal.ai_summary || signal.summary}</p>
                        {/* Raw content if safe */}
                    </div>
                </div>
            </main>
        )
    }

    return (
        <main className="min-h-screen bg-[#050505] text-white">
            <Navigation currentPage="archive" />

            {/* Preview Warning Banner */}
            {isPreview && (
                <div className="bg-yellow-500/20 border-b border-yellow-500/30 py-3 px-4 text-center">
                    <p className="text-sm font-semibold text-yellow-400">
                        ⚠️ PREVIEW MODE - This article is not published
                    </p>
                </div>
            )}

            <div className="pt-32 px-4 max-w-3xl mx-auto">
                <Link href="/archive" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-white mb-8 transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Back to Archive
                </Link>

                <article>
                    <header className="mb-10">
                        <h1 className="text-5xl font-bold mb-6 leading-tight">{article.headline}</h1>
                        <div className="flex gap-4 text-sm text-gray-500 font-mono">
                            <span>{new Date(article.published_at).toLocaleDateString()}</span>
                            <span className="text-cyan-400">{article.tier}</span>
                        </div>
                    </header>

                    <div className="prose prose-invert prose-lg max-w-none">
                        <p className="text-xl text-gray-300 leading-relaxed mb-8 font-medium">
                            {article.summary}
                        </p>

                        {article.generated_content && (
                            <div className="bg-white/5 p-6 rounded-2xl my-8 border border-white/10">
                                <h3 className="text-lg font-bold mb-4">Analysis</h3>
                                <p>{JSON.stringify(article.generated_content)}</p>
                            </div>
                        )}
                    </div>
                </article>
            </div>
        </main>
    )
}
