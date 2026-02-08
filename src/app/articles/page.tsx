import Link from 'next/link'
import { db } from '@/db'
import { articles } from '@/db/schema'
import { desc, eq } from 'drizzle-orm'
import { Navigation } from '@/components/Navigation'
import { Footer } from '@/components/Footer'

export const dynamic = 'force-dynamic'

function formatDate(date: Date | string) {
    return new Date(date).toLocaleDateString('en-CA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    })
}

function timeAgo(date: Date | string) {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
    return formatDate(date)
}

export default async function ArticlesPage({ searchParams }: { searchParams: { tag?: string } }) {
    const tag = searchParams.tag

    let publishedArticles: any[] = []
    try {
        publishedArticles = await db.query.articles.findMany({
            where: eq(articles.status, 'published'),
            orderBy: [desc(articles.publishedAt)],
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
        <div className="min-h-screen relative">
            {/* Ambient background effects */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-red-500/[0.07] rounded-full blur-[120px]" />
                <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-red-900/[0.05] rounded-full blur-[100px]" />
            </div>

            <Navigation />

            <main className="relative z-10">
                {/* Page Header */}
                <section className="relative overflow-hidden">
                    <div className="max-w-6xl mx-auto px-6 pt-12 pb-8">
                        {tag ? (
                            <div className="flex items-center gap-3 mb-4">
                                <Link href="/articles" className="text-slate-500 hover:text-white transition-colors">
                                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                                        <path d="M12 5l-5 5 5 5" />
                                    </svg>
                                </Link>
                                <div>
                                    <span className="text-sm text-slate-500">Filtered by</span>
                                    <h1 className="text-3xl font-bold text-white">{tag}</h1>
                                </div>
                                <Link href="/articles" className="ml-auto text-xs text-slate-500 hover:text-red-400 transition-colors px-3 py-1 rounded-lg border border-white/10 hover:border-red-500/30">
                                    Clear filter
                                </Link>
                            </div>
                        ) : (
                            <div>
                                <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">All Articles</h1>
                                <p className="text-slate-400">Browse our complete archive of Canadian political intelligence.</p>
                            </div>
                        )}
                    </div>
                    <div className="max-w-6xl mx-auto px-6">
                        <div className="h-px bg-gradient-to-r from-red-500/40 via-red-500/10 to-transparent" />
                    </div>
                </section>

                {/* Tag Cloud */}
                {sortedTags.length > 0 && (
                    <div className="max-w-6xl mx-auto px-6 py-8">
                        <div className="flex flex-wrap gap-2">
                            {sortedTags.slice(0, 30).map(([t, count]) => (
                                <Link
                                    key={t}
                                    href={t === tag ? '/articles' : `/articles?tag=${encodeURIComponent(t)}`}
                                    className={`text-xs px-3 py-1.5 rounded-lg border ${t === tag
                                        ? 'bg-red-500/20 text-red-300 border-red-500/40 shadow-lg shadow-red-500/10'
                                        : 'bg-white/[0.03] text-slate-500 border-white/[0.06] hover:bg-white/[0.06] hover:text-slate-300 hover:border-white/[0.12]'
                                        }`}
                                >
                                    {t}
                                    <span className="ml-1.5 text-[10px] opacity-50">{count}</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                {/* Articles Grid */}
                {publishedArticles.length === 0 ? (
                    <div className="max-w-6xl mx-auto px-6 py-20 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-6">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-600">
                                <path d="M12 6v12M6 12h12" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-3">
                            {tag ? `No articles tagged "${tag}"` : 'No articles yet'}
                        </h2>
                        <p className="text-slate-500 mb-8 max-w-md mx-auto">
                            {tag ? 'Try a different tag or browse all articles.' : 'Intelligence reports will appear here once published.'}
                        </p>
                        <Link href={tag ? '/articles' : '/'} className="inline-block px-6 py-2.5 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-colors">
                            {tag ? 'View All Articles' : 'Back to Home'}
                        </Link>
                    </div>
                ) : (
                    <div className="max-w-6xl mx-auto px-6 pb-16">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {publishedArticles.map(article => (
                                <Link key={article.id} href={`/articles/${article.slug}`} className="group block">
                                    <article className="h-full rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 hover:border-white/[0.12] hover:bg-white/[0.04] flex flex-col">
                                        <div className="flex items-center gap-2 mb-3">
                                            {article.publishedAt && (
                                                <time className="text-[11px] text-slate-600">
                                                    {timeAgo(article.publishedAt)}
                                                </time>
                                            )}
                                        </div>
                                        <h3 className="text-base font-semibold text-white mb-2 leading-snug group-hover:text-red-50 transition-colors line-clamp-2">
                                            {article.title}
                                        </h3>
                                        {article.summary && (
                                            <p className="text-sm text-slate-500 mb-4 leading-relaxed line-clamp-3 flex-1">
                                                {article.summary}
                                            </p>
                                        )}
                                        <div className="flex flex-wrap gap-1.5 mt-auto pt-3 border-t border-white/[0.04]">
                                            {article.tags?.slice(0, 3).map((t: string) => (
                                                <span
                                                    key={t}
                                                    className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-600"
                                                >
                                                    {t}
                                                </span>
                                            ))}
                                            {article.tags?.length > 3 && (
                                                <span className="text-[10px] text-slate-700">+{article.tags.length - 3}</span>
                                            )}
                                        </div>
                                    </article>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </main>

            <Footer />
        </div>
    )
}
