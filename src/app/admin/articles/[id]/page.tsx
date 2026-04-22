import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Article } from '@/types/database'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import ArticleEditor from './ArticleEditor'

export const dynamic = 'force-dynamic'

export default async function ArticleDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: article } = await supabase
    .from('articles')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!article) notFound()

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/articles" className="text-text-muted hover:text-text-secondary transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex items-center gap-2">
          <span className={`font-mono text-xs px-2 py-0.5 rounded-sm border ${
            article.status === 'published'
              ? 'text-confirmed border-confirmed/30 bg-confirmed/10'
              : 'text-text-muted border-border bg-raised'
          }`}>{article.status}</span>
          <span className="font-mono text-xs text-text-muted">
            Updated {new Date((article as Article).updated_at).toLocaleDateString('en-CA')}
          </span>
        </div>
      </div>
      <ArticleEditor article={article as Article} />
    </div>
  )
}
