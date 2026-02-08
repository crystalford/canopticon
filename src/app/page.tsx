import Link from 'next/link'
import { db } from '@/db'
import { articles } from '@/db/schema'
import { desc, eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export default async function HomePage({ searchParams }: { searchParams: { tag?: string } }) {
    const tag = searchParams.tag

    let publishedArticles: any[] = []
    try {
        publishedArticles = await db.query.articles.findMany({
            where: eq(articles.status, 'published'),
            orderBy: [desc(articles.publishedAt)],
            limit: 50,
        })

        if (tag) {
            publishedArticles = publishedArticles.filter(a => a.tags?.includes(tag))
        }
    } catch {
        // DB not available during build
    }

    // Collect all tags for the tag cloud
    const tagCounts: Record<string, number> = {}
    try {
        const allArticles = tag ? await db.query.articles.findMany({
            where: eq(articles.status, 'published'),
            columns: { tags: true },
        }) : publishedArticles
        for (const a of allArticles) {
            for (const t of (a.tags || [])) {
                tagCounts[t] = (tagCounts[t] || 0) + 1
            }
        }
    } catch {
        // DB not available during build
    }
    const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])

    return (
        <div className="min-h-screen">
            {/* Header */}
            <header className="border-b border-white/5">
                <div className="max-w-4xl mx-auto px-6 py-6 flex items-center justify-between">
                    <Link href="/" className="text-xl font-bold text-white tracking-wider">
                        CANOPTICON
                    </Link>
                    <Link
                        href="/dashboard"
                        className="text-sm text-slate-400 hover:text-white transition-colors"
                    >
                        Dashboard
                    </Link>
                </div>
            </header>

            {/* Content */}
            <main className="max-w-4xl mx-auto px-6 py-12">
                {/* Tag Cloud */}
                {sortedTags.length > 0 && (
                    <div className="mb-8">
                        <div className="flex flex-wrap gap-2">
                            {tag && (
                                <Link
                                    href="/"
                                    className="text-xs px-2.5 py-1 rounded-full bg-slate-700 text-white border border-slate-600 hover:bg-slate-600 transition-colors"
                                >
                                    All articles
                                </Link>
                            )}
                            {sortedTags.map(([t, count]) => (
                                <Link
                                    key={t}
                                    href={t === tag ? '/' : `/?tag=${encodeURIComponent(t)}`}
                                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                                        t === tag
                                            ? 'bg-primary-500/20 text-primary-300 border-primary-500/40'
                                            : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10 hover:text-white'
                                    }`}
                                >
                                    {t} <span className="text-slate-500 ml-0.5">{count}</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                {/* Active filter */}
                {tag && (
                    <div className="mb-6 flex items-center gap-2">
                        <span className="text-sm text-slate-400">Showing articles tagged</span>
                        <span className="text-sm font-medium text-primary-400">{tag}</span>
                        <Link href="/" className="text-xs text-slate-500 hover:text-white ml-2">&times; clear</Link>
                    </div>
                )}

                {publishedArticles.length === 0 ? (
                    <div className="text-center py-20">
                        <h2 className="text-2xl font-bold text-white mb-4">
                            {tag ? `No articles tagged "${tag}"` : 'No articles yet'}
                        </h2>
                        <p className="text-slate-400 mb-6">
                            {tag ? 'Try a different tag or view all articles.' : 'Go to the dashboard and start publishing.'}
                        </p>
                        <Link href={tag ? '/' : '/dashboard'} className="btn-primary">
                            {tag ? 'View All' : 'Open Dashboard'}
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {publishedArticles.map(article => (
                            <article key={article.id} className="group">
                                <Link href={`/articles/${article.slug}`}>
                                    <div className="glass-card p-6">
                                        <h2 className="text-xl font-bold text-white group-hover:text-primary-400 transition-colors mb-2">
                                            {article.title}
                                        </h2>
                                        {article.summary && (
                                            <p className="text-slate-400 mb-3">{article.summary}</p>
                                        )}
                                        <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
                                            <span>{article.author}</span>
                                            {article.publishedAt && (
                                                <>
                                                    <span>&middot;</span>
                                                    <time>{new Date(article.publishedAt).toLocaleDateString('en-CA', {
                                                        year: 'numeric',
                                                        month: 'long',
                                                        day: 'numeric',
                                                    })}</time>
                                                </>
                                            )}
                                        </div>
                                        {article.tags?.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5">
                                                {article.tags.slice(0, 5).map((t: string) => (
                                                    <span
                                                        key={t}
                                                        className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-slate-500"
                                                    >
                                                        {t}
                                                    </span>
                                                ))}
                                                {article.tags.length > 5 && (
                                                    <span className="text-xs text-slate-600">+{article.tags.length - 5}</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </Link>
                            </article>
                        ))}
                    </div>
                )}
            </main>
        </div>
    )
}
