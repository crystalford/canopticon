
import Link from 'next/link'
import { db, articles } from '@/db'
import { eq, desc } from 'drizzle-orm'
import Logo from '@/components/Logo'
import { ArrowRight } from 'lucide-react'

export const dynamic = 'force-dynamic'

async function getArticles() {
    return db
        .select()
        .from(articles)
        .where(eq(articles.isDraft, false))
        .orderBy(desc(articles.publishedAt))
        .limit(10)
}

export default async function HomePage() {
    const allArticles = await getArticles()
    const featured = allArticles[0]
    const recent = allArticles.slice(1)

    return (
        <div className="min-h-screen bg-background text-slate-300 font-sans selection:bg-primary-500/30">
            {/* Nav */}
            <header className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-white/5">
                <div className="max-w-screen-xl mx-auto px-6 h-20 flex items-center justify-between">
                    <Link href="/">
                        <Logo />
                    </Link>
                    <Link href="/dashboard" className="text-xs font-bold text-slate-400 hover:text-white transition-colors tracking-widest uppercase flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        Operator Login
                    </Link>
                </div>
            </header>

            <main className="pt-40 pb-20 px-6">
                {/* Hero Manifesto */}
                <section className="max-w-screen-xl mx-auto mb-32 border-b border-white/10 pb-24">
                    <h1 className="text-6xl md:text-8xl font-bold text-white tracking-tighter mb-10 leading-[0.9]">
                        CANOPTICON <br />
                        <span className="text-white">INVESTIGATES.</span>
                    </h1>
                    <div className="grid md:grid-cols-3 gap-12">
                        <div className="md:col-span-2">
                            <p className="text-2xl text-slate-400 leading-relaxed font-light">
                                An independent check on Canadian power. Canopticon synthesizes primary-source data from Hansard, court records, and official releases into high-fidelity political analysis.
                            </p>
                        </div>
                        <div className="flex flex-col justify-end">
                            <div className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-3">System Status</div>
                            <div className="flex items-center gap-3 text-emerald-400 text-sm font-mono border border-emerald-500/20 bg-emerald-500/5 px-4 py-2 rounded">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                OPERATIONAL
                            </div>
                        </div>
                    </div>
                </section>

                {/* Featured Dispatch */}
                {featured && (
                    <section className="max-w-screen-xl mx-auto mb-32">
                        <div className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-8 flex items-center gap-2">
                            <div className="w-1 h-4 bg-primary-500" />
                            Latest Dispatch
                        </div>

                        <Link href={`/articles/${featured.slug}`} className="group block">
                            <article className="grid lg:grid-cols-2 gap-16 items-start">
                                <div>
                                    <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 group-hover:text-primary-400 transition-colors leading-tight">
                                        {featured.headline}
                                    </h2>
                                    <div className="flex items-center gap-4 text-sm text-slate-500 font-mono mb-6">
                                        <span className="text-primary-500">{new Date(featured.publishedAt!).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                                        <span className="w-px h-3 bg-slate-700" />
                                        <span>{featured.readingTime || 5} MIN READ</span>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xl text-slate-400 leading-relaxed border-l-2 border-white/10 pl-6 group-hover:border-primary-500/50 transition-colors">
                                        {featured.excerpt || featured.summary || "No excerpt available for this dispatch."}
                                    </p>
                                    <div className="mt-8 flex items-center text-primary-400 font-bold group-hover:translate-x-2 transition-transform tracking-wide text-sm">
                                        READ DEEP DIVE <ArrowRight className="w-4 h-4 ml-2" />
                                    </div>
                                </div>
                            </article>
                        </Link>
                    </section>
                )}

                {/* Recent Feed */}
                {recent.length > 0 && (
                    <section className="max-w-screen-xl mx-auto">
                        <div className="flex items-center justify-between mb-12 border-t border-white/10 pt-12">
                            <div className="text-xs font-mono text-slate-500 uppercase tracking-widest">
                                Recent Intel
                            </div>
                            <div className="text-xs font-mono text-slate-600">
                                ARCHIVE ACCESSIBLE
                            </div>
                        </div>

                        <div className="grid md:grid-cols-3 gap-x-8 gap-y-16">
                            {recent.map(article => (
                                <Link key={article.id} href={`/articles/${article.slug}`} className="group block h-full flex flex-col pt-4 border-t border-white/5 hover:border-primary-500/30 transition-colors">
                                    <div className="text-xs font-mono text-slate-500 mb-4 flex justify-between">
                                        <span>{new Date(article.publishedAt!).toLocaleDateString()}</span>
                                    </div>
                                    <h3 className="text-2xl font-bold text-white mb-4 group-hover:text-primary-400 transition-colors leading-tight">
                                        {article.headline}
                                    </h3>
                                    <p className="text-slate-400 text-sm leading-relaxed mb-6 line-clamp-3">
                                        {article.summary}
                                    </p>
                                    <div className="mt-auto text-xs font-bold text-white uppercase tracking-wider group-hover:text-primary-400 transition-colors flex items-center gap-2">
                                        Read Report <ArrowRight className="w-3 h-3" />
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}

                {allArticles.length === 0 && (
                    <div className="text-center py-32 border-t border-white/10">
                        <div className="text-slate-500 font-mono text-sm">NO INTELLIGENCE PUBLISHED</div>
                    </div>
                )}
            </main>

            <footer className="border-t border-white/5 py-12 px-6 bg-black/20">
                <div className="max-w-screen-xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="text-slate-600 text-xs font-mono">
                        &copy; {new Date().getFullYear()} CANOPTICON INTELLIGENCE.
                    </div>
                    <div className="text-slate-700 text-xs tracking-widest uppercase">
                        Primary Source • Zero Bias • Real Time
                    </div>
                </div>
            </footer>
        </div>
    )
}
