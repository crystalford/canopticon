import Link from 'next/link'
import { db, articles } from '@/db'
import { eq, desc } from 'drizzle-orm'
import { NewsletterSection } from '@/components/newsletter'
import { ArrowRight, Globe, Shield, Activity, Calendar } from 'lucide-react'
import Logo from '@/components/Logo'

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
        <div className="min-h-screen bg-background text-slate-300 selection:bg-primary-500/30">
            {/* Header */}
            <header className="border-b border-white/5 bg-black/20 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <Link href="/">
                        <Logo />
                    </Link>
                    <nav className="flex items-center gap-8">
                        <Link href="/dashboard" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">
                            Operator Login
                        </Link>
                    </nav>
                </div>
            </header>

            <main>
                {/* Hero */}
                <section className="relative py-32 px-6 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-primary-500/5 to-transparent pointer-events-none" />
                    <div className="max-w-4xl mx-auto text-center relative z-10">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-primary-300 font-mono mb-8">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            SYSTEM ONLINE
                        </div>
                        <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white mb-6">
                            Primary-Source <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-indigo-400">Political Intelligence</span>
                        </h1>
                        <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
                            Real-time synthesis of Canadian political events. No opinion. No spin. Just raw data and structured analysis.
                        </p>
                        <div className="flex justify-center gap-4">
                            <Link href="#articles" className="btn-primary group">
                                Read Intelligence
                                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                            </Link>
                        </div>
                    </div>
                </section>

                {/* Articles */}
                <section id="articles" className="py-20 px-6">
                    <div className="max-w-7xl mx-auto">
                        <div className="flex items-center justify-between mb-12">
                            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                                <Activity className="w-6 h-6 text-primary-500" />
                                Latest Dispatches
                            </h2>
                        </div>

                        {publishedArticles.length === 0 ? (
                            <div className="glass-panel p-16 text-center">
                                <Activity className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-white mb-2">Awaiting Intelligence</h3>
                                <p className="text-slate-500 max-w-sm mx-auto">
                                    The ingestion pipeline is currently active. New dispatches will appear here shortly.
                                </p>
                            </div>
                        ) : (
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {publishedArticles.map(article => (
                                    <Link
                                        key={article.id}
                                        href={`/articles/${article.slug}`}
                                        className="glass-card flex flex-col h-full group p-6"
                                    >
                                        <div className="flex items-center gap-2 mb-4 text-xs font-mono text-slate-500">
                                            <Calendar className="w-3 h-3" />
                                            {article.publishedAt ? new Date(article.publishedAt).toLocaleDateString() : 'DRAFT'}
                                        </div>

                                        <h3 className="text-xl font-bold text-white mb-3 group-hover:text-primary-400 transition-colors">
                                            {article.headline}
                                        </h3>

                                        <p className="text-slate-400 text-sm leading-relaxed mb-4 line-clamp-3">
                                            {article.summary}
                                        </p>

                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </section>

                {/* Features */}
                <section className="py-20 px-6 border-t border-white/5 bg-white/5">
                    <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-12">
                        <Feature
                            icon={Globe}
                            title="Primary Only"
                            desc="Sourced directly from Hansard, Court Records, and official releases."
                        />
                        <Feature
                            icon={Activity}
                            title="Real-Time"
                            desc="Events detected and synthesized within minutes of occurrence."
                        />
                        <Feature
                            icon={Shield}
                            title="Zero Bias"
                            desc="Non-performative, non-adversarial. Strict structural reporting."
                        />
                    </div>
                </section>
            </main>

            <footer className="border-t border-white/5 py-12 px-6 text-center text-slate-600 text-sm">
                <p>&copy; {new Date().getFullYear()} CANOPTICON. All rights reserved.</p>
            </footer>
        </div>
    )
}

function Feature({ icon: Icon, title, desc }: any) {
    return (
        <div className="text-center">
            <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4 text-primary-400">
                <Icon className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
            <p className="text-slate-400 leading-relaxed">{desc}</p>
        </div>
    )
}
