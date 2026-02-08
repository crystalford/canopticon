import Link from 'next/link'
import { db } from '@/db'
import { articles } from '@/db/schema'
import { desc, eq } from 'drizzle-orm'
import { Navigation } from '@/components/Navigation'
import { Footer } from '@/components/Footer'
import { NewsletterForm } from '@/components/NewsletterForm'

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

    const featured = !tag && publishedArticles.length > 0 ? publishedArticles[0] : null
    const rest = featured ? publishedArticles.slice(1) : publishedArticles

    return (
        <div className="min-h-screen relative">
            {/* Ambient background effects */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-red-500/[0.07] rounded-full blur-[120px]" />
                <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-red-900/[0.05] rounded-full blur-[100px]" />
            </div>

            <Navigation />

            <main className="relative z-10">
                {/* Hero Section — only when no tag filter */}
                {!tag && (
                    <section className="relative overflow-hidden">
                        <div className="max-w-6xl mx-auto px-6 pt-20 pb-16">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                                <div>
                                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium mb-6">
                                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                                        AI-Powered Intelligence
                                    </div>
                                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-[1.1] tracking-tight mb-6">
                                        Canadian Political
                                        <br />
                                        <span className="bg-gradient-to-r from-red-400 via-red-500 to-orange-500 bg-clip-text text-transparent">
                                            Intelligence
                                        </span>
                                    </h1>
                                    <p className="text-lg text-slate-400 leading-relaxed max-w-lg">
                                        AI-driven analysis of Parliament, policy, and power.
                                        Automated monitoring. Investigative depth. Published at machine speed.
                                    </p>
                                </div>
                                <div className="lg:pl-8">
                                    <NewsletterForm />
                                </div>
                            </div>
                        </div>
                        {/* Decorative line */}
                        <div className="max-w-6xl mx-auto px-6">
                            <div className="h-px bg-gradient-to-r from-red-500/40 via-red-500/10 to-transparent" />
                        </div>
                    </section>
                )}

                {/* Tag filter header */}
                {tag && (
                    <div className="max-w-6xl mx-auto px-6 pt-12 pb-4">
                        <div className="flex items-center gap-3">
                            <Link href="/" className="text-slate-500 hover:text-white transition-colors">
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M12 5l-5 5 5 5" />
                                </svg>
                            </Link>
                            <div>
                                <span className="text-sm text-slate-500">Filtered by</span>
                                <h2 className="text-2xl font-bold text-white">{tag}</h2>
                            </div>
                            <Link href="/" className="ml-auto text-xs text-slate-500 hover:text-red-400 transition-colors px-3 py-1 rounded-lg border border-white/10 hover:border-red-500/30">
                                Clear filter
                            </Link>
                        </div>
                    </div>
                )}

                {/* Tag Cloud */}
                {sortedTags.length > 0 && (
                    <div className="max-w-6xl mx-auto px-6 py-8">
                        <div className="flex flex-wrap gap-2">
                            {sortedTags.slice(0, 20).map(([t, count]) => (
                                <Link
                                    key={t}
                                    href={t === tag ? '/' : `/?tag=${encodeURIComponent(t)}`}
                                    className={`text-xs px-3 py-1.5 rounded-lg border transition-all duration-200 ${t === tag
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
                        <Link href={tag ? '/' : '/dashboard'} className="btn-primary">
                            {tag ? 'View All Articles' : 'Open Dashboard'}
                        </Link>
                    </div>
                ) : (
                    <div className="max-w-6xl mx-auto px-6 pb-16">
                        {/* Featured Article */}
                        {featured && (
                            <Link href={`/articles/${featured.slug}`} className="block group mb-10">
                                <article className="relative rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-8 md:p-10 overflow-hidden hover:border-white/[0.12] hover:from-white/[0.06] hover:to-white/[0.02]">
                                    {/* Glow accent */}
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/[0.06] rounded-full blur-[80px] transition-opacity group-hover:opacity-100 opacity-50" />

                                    <div className="relative">
                                        <div className="flex items-center gap-3 mb-4">
                                            <span className="text-[10px] font-semibold uppercase tracking-widest text-red-400 bg-red-500/10 px-2.5 py-1 rounded-md border border-red-500/20">
                                                Latest
                                            </span>
                                            {featured.publishedAt && (
                                                <span className="text-xs text-slate-500">
                                                    {timeAgo(featured.publishedAt)}
                                                </span>
                                            )}
                                        </div>
                                        <h2 className="text-2xl md:text-3xl font-bold text-white mb-3 group-hover:text-red-50 transition-colors leading-tight">
                                            {featured.title}
                                        </h2>
                                        {featured.summary && (
                                            <p className="text-slate-400 text-lg leading-relaxed mb-5 max-w-2xl">
                                                {featured.summary}
                                            </p>
                                        )}
                                        <div className="flex items-center justify-between">
                                            <div className="flex flex-wrap gap-2">
                                                {featured.tags?.slice(0, 4).map((t: string) => (
                                                    <span
                                                        key={t}
                                                        className="text-xs px-2 py-0.5 rounded-md bg-white/[0.04] text-slate-500 border border-white/[0.06]"
                                                    >
                                                        {t}
                                                    </span>
                                                ))}
                                            </div>
                                            <span className="text-sm text-slate-500 group-hover:text-red-400 transition-colors flex items-center gap-1.5">
                                                Read
                                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" className="transition-transform group-hover:translate-x-0.5">
                                                    <path d="M5 3l4 4-4 4" />
                                                </svg>
                                            </span>
                                        </div>
                                    </div>
                                </article>
                            </Link>
                        )}

                        {/* Article Grid */}
                        {rest.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {rest.map(article => (
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
                        )}
                    </div>
                )}
            </main>

            <Footer />
        </div>
    )
}
