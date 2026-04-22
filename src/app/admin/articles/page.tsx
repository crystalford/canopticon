import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Article } from '@/types/database'
import { Plus, FileText } from 'lucide-react'
import ArticleActions from './ArticleActions'

export const dynamic = 'force-dynamic'

export default async function ArticlesPage() {
  const supabase = createClient()
  const { data: articles } = await supabase
    .from('articles')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(50)

  const published = (articles ?? []).filter(a => a.status === 'published').length
  const drafts = (articles ?? []).filter(a => a.status === 'draft').length

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-text-primary">Articles</h1>
          <p className="font-mono text-xs text-text-muted mt-1">{published} published · {drafts} drafts</p>
        </div>
        <Link href="/admin/articles/new" className="btn-primary flex items-center gap-2">
          <Plus size={14} /> New Article
        </Link>
      </div>

      <div className="glass-panel overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="font-mono text-xs text-text-muted text-left px-4 py-3">TITLE</th>
              <th className="font-mono text-xs text-text-muted text-left px-4 py-3 hidden sm:table-cell">STATUS</th>
              <th className="font-mono text-xs text-text-muted text-left px-4 py-3 hidden md:table-cell">UPDATED</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {(articles as Article[])?.map((article) => (
              <tr key={article.id} className="border-b border-border/50 hover:bg-raised/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <FileText size={13} className="text-text-muted shrink-0" />
                    <Link href={`/admin/articles/${article.id}`} className="font-display text-text-primary hover:text-signal transition-colors line-clamp-1">
                      {article.title}
                    </Link>
                  </div>
                  {article.summary && (
                    <p className="font-mono text-xs text-text-muted mt-0.5 line-clamp-1 pl-5">{article.summary}</p>
                  )}
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <span className={`font-mono text-xs px-2 py-0.5 rounded-sm border ${
                    article.status === 'published'
                      ? 'text-confirmed border-confirmed/30 bg-confirmed/10'
                      : 'text-text-muted border-border bg-raised'
                  }`}>{article.status}</span>
                </td>
                <td className="px-4 py-3 hidden md:table-cell font-mono text-xs text-text-muted">
                  {new Date(article.updated_at).toLocaleDateString('en-CA')}
                </td>
                <td className="px-4 py-3">
                  <ArticleActions articleId={article.id} status={article.status} />
                </td>
              </tr>
            ))}
            {(!articles || articles.length === 0) && (
              <tr><td colSpan={4} className="px-4 py-12 text-center font-mono text-xs text-text-muted">No articles yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
