import Link from 'next/link'
import PublicNavigation from '@/components/PublicNavigation'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { FileText, Calendar, ArrowRight } from 'lucide-react'

export const metadata = {
  title: 'Archive - CANOPTICON',
  description: 'Complete chronological archive of Canadian political signals and analysis.',
}

export default async function ArchivePage() {

  // Fetch All Archive-Ready Signals
  const { data: signals } = await supabaseAdmin
    .from('signals')
    .select('*, sources(name, category)')
    .in('status', ['published', 'approved', 'archived']) // Show essentially everything except trash/pending? Or just Approved?
    // Tech Spec says: "Auto-Publishing Logic: APPROVED signals -> published_archive"
    // So we show 'published' and 'approved'
    .in('status', ['published', 'approved'])
    .order('published_at', { ascending: false })
    .limit(100);

  return (
    <main className="min-h-screen bg-[#050505] text-white selection:bg-cyan-500/30">
      <PublicNavigation currentPage="archive" />

      <div className="pt-32 pb-20 px-4 max-w-4xl mx-auto">
        <header className="mb-12 border-b border-white/10 pb-8">
          <h1 className="text-4xl font-bold mb-4">Signal Archive</h1>
          <p className="text-gray-400">
            Comprehensive timeline of detected political signals, legislation, and media narratives.
          </p>
        </header>

        <div className="space-y-8">
          {signals?.map((signal) => {
            const date = new Date(signal.published_at || signal.created_at);
            return (
              <article key={signal.id} className="group relative pl-8 border-l border-white/10 hover:border-cyan-500/50 transition-colors">
                <div className="absolute -left-1.5 top-0 w-3 h-3 rounded-full bg-black border border-white/20 group-hover:border-cyan-500 group-hover:bg-cyan-900 transition-colors" />

                <div className="mb-2 flex items-center gap-3 text-xs text-gray-500 font-mono">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {date.toLocaleDateString()}
                  </span>
                  <span>•</span>
                  <span className="text-cyan-400 group-hover:text-cyan-300">
                    {/* @ts-ignore */}
                    {signal.sources?.name || signal.source}
                  </span>
                </div>

                <Link href={`/articles/${signal.hash || signal.id}`} className="block group-hover:translate-x-1 transition-transform">
                  <h2 className="text-xl font-bold mb-2 group-hover:text-cyan-400 transition-colors">
                    {signal.headline}
                  </h2>
                  <p className="text-gray-400 text-sm leading-relaxed mb-4 line-clamp-3">
                    {signal.ai_summary || signal.summary}
                  </p>
                </Link>

                <div className="flex gap-2">
                  {signal.entities?.slice(0, 3).map((e: string, i: number) => (
                    <span key={i} className="px-2 py-1 bg-white/5 rounded text-xs text-gray-500">{e}</span>
                  ))}
                </div>
              </article>
            )
          })}

          {(!signals || signals.length === 0) && (
            <div className="py-20 text-center text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>No archived signals found.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
