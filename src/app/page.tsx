import Link from 'next/link'
import { db, articles } from '@/db'
import { eq, desc } from 'drizzle-orm'
import { NewsletterSection } from '@/components/newsletter'

export const dynamic = 'force-dynamic'

async function getPublishedArticles() {
    return db
        .select({
            id: articles.id,
            slug: articles.slug,
            headline: articles.headline,
            summary: articles.summary,
            topics: articles.topics,
            publishedAt: articles.publishedAt,
        })
        .from(articles)
        .where(eq(articles.isDraft, false))
        .orderBy(desc(articles.publishedAt))
        .limit(20)
}

export default async function HomePage() {
    const publishedArticles = await getPublishedArticles()

    return (
        <div className="min-h-screen">
            {/* Header */}
            <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-sm">C</span>
                            </div>
                            <span className="font-semibold text-xl tracking-tight">CANOPTICON</span>
                        </div>
                        <nav className="flex items-center gap-6">
                            <Link href="/" className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors">
                                Home
                            </Link>
                            <Link href="/dashboard" className="btn-primary text-sm">
                                Operator Dashboard
                            </Link>
                        </nav>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <main>
                <section className="py-20 px-4 sm:px-6 lg:px-8">
                    <div className="max-w-4xl mx-auto text-center">
                        <h1 className="text-5xl font-bold tracking-tight text-slate-900 dark:text-white mb-6">
                            Primary-Source Political Intelligence
                        </h1>
                        <p className="text-xl text-slate-600 dark:text-slate-300 mb-8 max-w-2xl mx-auto">
                            Real-time synthesis of Canadian political events from authoritative sources.
                            No opinion. No spin. Just structure.
                        </p>
                        <div className="flex justify-center gap-4">
                            <Link href="#articles" className="btn-primary">
                                Read Latest
                            </Link>
                        </div>
                    </div>
                </section>

                {/* Articles Section */}
                <section id="articles" className="py-16 px-4 sm:px-6 lg:px-8 bg-slate-50 dark:bg-slate-800/50">
                    <div className="max-w-7xl mx-auto">
                        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-8">
                            Latest Articles
                        </h2>

                        {publishedArticles.length === 0 ? (
                            <div className="card p-12 text-center">
                                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                                    No articles yet
                                </h3>
                                <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                                    The system is initializing. Articles will appear here once the ingestion pipeline processes primary sources.
                                </p>
                            </div>
                        ) : (
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {publishedArticles.map(article => (
                                    <Link
                                        key={article.id}
                                        href={`/articles/${article.slug}`}
                                        className="card p-6 block hover:shadow-lg transition-shadow"
                                    >
                                        {article.publishedAt && (
                                            <time className="text-xs text-slate-500 dark:text-slate-400">
                                                {new Date(article.publishedAt).toLocaleDateString('en-CA', {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric',
                                                })}
                                            </time>
                                        )}
                                        <h3 className="font-semibold text-slate-900 dark:text-white mt-1 mb-2 line-clamp-2">
                                            {article.headline}
                                        </h3>
                                        <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-3">
                                            {article.summary.slice(0, 150)}...
                                        </p>
                                        {article.topics && article.topics.length > 0 && (
                                            <div className="flex gap-1 mt-3 flex-wrap">
                                                {article.topics.slice(0, 3).map(topic => (
                                                    <span
                                                        key={topic}
                                                        className="text-xs px-2 py-0.5 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 rounded"
                                                    >
                                                        {topic}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </section>

                {/* Newsletter Section */}
                <section className="py-16 px-4 sm:px-6 lg:px-8">
                    <div className="max-w-xl mx-auto">
                        <NewsletterSection />
                    </div>
                </section>

                {/* Info Section */}
                <section className="py-16 px-4 sm:px-6 lg:px-8 bg-slate-50 dark:bg-slate-800/50">
                    <div className="max-w-7xl mx-auto">
                        <div className="grid md:grid-cols-3 gap-8">
                            <div className="text-center">
                                <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-xl flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Primary Sources Only</h3>
                                <p className="text-slate-600 dark:text-slate-400 text-sm">
                                    Direct from Parliament, PMO, federal ministries, and courts. No opinion journalism.
                                </p>
                            </div>
                            <div className="text-center">
                                <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-xl flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                </div>
                                <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Near Real-Time</h3>
                                <p className="text-slate-600 dark:text-slate-400 text-sm">
                                    Events detected and synthesized within minutes of occurrence.
                                </p>
                            </div>
                            <div className="text-center">
                                <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-xl flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                                    </svg>
                                </div>
                                <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Neutral Posture</h3>
                                <p className="text-slate-600 dark:text-slate-400 text-sm">
                                    Non-performative, non-adversarial. Structure over spin.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="border-t border-slate-200 dark:border-slate-800 py-8 px-4 sm:px-6 lg:px-8">
                <div className="max-w-7xl mx-auto text-center text-slate-500 dark:text-slate-400 text-sm">
                    <p>© 2026 CANOPTICON. Primary-source political synthesis.</p>
                </div>
            </footer>
        </div>
    )
}
