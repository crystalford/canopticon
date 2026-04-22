import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Article } from '@/types/database'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'

export const dynamic = 'force-dynamic'

export default async function ArticlePage({ params }: { params: { slug: string } }) {
  const supabase = createClient()
  const { data: article } = await supabase
    .from('articles')
    .select('*')
    .eq('slug', params.slug)
    .eq('status', 'published')
    .single()

  if (!article) notFound()

  const a = article as Article & { article_type?: string }

  return (
    <div className="min-h-screen bg-void text-text-primary">
      <header className="border-b border-border bg-base/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="font-display text-lg font-bold text-brand tracking-wider hover:opacity-80 transition-opacity">
            CANOPTICON
          </Link>
          <span className="font-mono text-xs text-text-muted">Canadian Political Intelligence</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-8 space-y-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="font-mono text-xs text-text-muted hover:text-signal transition-colors">← Intelligence</Link>
          </div>
          <div className="flex items-center gap-2">
            {a.article_type && (
              <span className="font-mono text-[10px] text-signal">{a.article_type.replace('_', ' ').toUpperCase()}</span>
            )}
            {a.published_at && (
              <span className="font-mono text-xs text-text-muted">{new Date(a.published_at).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            )}
          </div>
          <h1 className="font-display text-2xl font-bold text-text-primary leading-tight">{a.title}</h1>
          {a.summary && (
            <p className="font-body text-text-secondary text-base leading-relaxed border-l-2 border-signal/40 pl-4">{a.summary}</p>
          )}
        </div>

        <div className="prose prose-invert prose-sm max-w-none font-body
          prose-headings:font-display prose-headings:font-semibold prose-headings:text-text-primary
          prose-p:text-text-secondary prose-p:leading-relaxed
          prose-a:text-signal prose-a:no-underline hover:prose-a:underline
          prose-strong:text-text-primary
          prose-code:text-hypothesis prose-code:bg-raised prose-code:px-1 prose-code:rounded-sm
          prose-blockquote:border-signal/40 prose-blockquote:text-text-muted
          prose-li:text-text-secondary
        ">
          <ReactMarkdown>{a.content}</ReactMarkdown>
        </div>
      </main>

      <footer className="border-t border-border mt-20">
        <div className="max-w-3xl mx-auto px-6 py-8 flex items-center justify-between">
          <p className="font-mono text-xs text-text-muted">CANOPTICON</p>
          <Link href="/" className="font-mono text-xs text-text-muted hover:text-signal transition-colors">← All Intelligence</Link>
        </div>
      </footer>
    </div>
  )
}
