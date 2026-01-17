import Link from 'next/link'
import { db, articles } from '@/db'
import { eq, desc } from 'drizzle-orm'
import Logo from '@/components/Logo'
import { ArrowRight } from 'lucide-react'
import { NewsletterForm } from '@/components/newsletter/NewsletterForm'

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

            <main className="pt-20">
                {/* Hero Section */}
                <section className="relative pt-6 pb-12 md:pt-12 md:pb-16 overflow-hidden border-b border-white/10 mb-12">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary-900/10 via-background to-background z-0" />

                    <div className="container relative z-10 mx-auto px-4 text-center">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-primary-400 mb-6 animate-fade-in-up">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500"></span>
                            </span>
                            SYSTEM OPERATIONAL
                        </div>

                        <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter text-white mb-6 animate-fade-in-up md:leading-[0.9]">
                            UNFILTERED<br />
                            INTELLIGENCE
                        </h1>

                        <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-8 leading-relaxed animate-fade-in-up delay-100">
                            Operational intelligence for the information age. We deploy advanced forensic systems to uncover what matters in Canadian politics.
                        </p>

                        <div className="flex flex-col items-center gap-6 animate-fade-in-up delay-200">
                            <div className="w-full max-w-md bg-white/5 border border-white/10 p-2 rounded-xl backdrop-blur-sm">
                                <NewsletterForm />
                            </div>
                            <p className="text-xs text-slate-600">
                                Join 5,000+ subscribers receiving daily intelligence briefs.
                            </p>
                        </div>
                    </div>
                </section>

                <div className="px-6">
                    {/* Featured Dispatch */}
                    {featured && (
                        <section className="max-w-screen-xl mx-auto mb-20">
                            <div className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                                <div className="w-1 h-4 bg-primary-500" />
                                Latest Dispatch
                            </div>

                            <Link href={`/articles/${featured.slug}`} className="group block">
                                <article className="grid lg:grid-cols-2 gap-12 items-start">
                                    <div>
                                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 group-hover:text-primary-400 transition-colors leading-tight">
                                            {featured.headline}
                                        </h2>
                                        <div className="flex items-center gap-4 text-sm text-slate-500 font-mono mb-6">
                                            <span className="text-primary-500">{new Date(featured.publishedAt!).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                                            <span className="w-px h-3 bg-slate-700" />
                                            <span>{featured.readingTime || 5} MIN READ</span>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-lg text-slate-400 leading-relaxed border-l-2 border-white/10 pl-6 group-hover:border-primary-500/50 transition-colors">
                                            {featured.excerpt || featured.summary || "No excerpt available for this dispatch."}
                                        </p>
                                        <div className="mt-6 flex items-center text-primary-400 font-bold group-hover:translate-x-2 transition-transform tracking-wide text-sm">
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
                            <div className="flex items-center justify-between mb-8 border-t border-white/10 pt-8">
                                <div className="text-xs font-mono text-slate-500 uppercase tracking-widest">
                                    Recent Intel
                                </div>
                                <div className="text-xs font-mono text-slate-600">
                                    ARCHIVE ACCESSIBLE
                                </div>
                            </div>

                            <div className="grid md:grid-cols-3 gap-x-8 gap-y-12">
                                {recent.map(article => (
                                    <Link key={article.id} href={`/articles/${article.slug}`} className="group block h-full flex flex-col pt-4 border-t border-white/5 hover:border-primary-500/30 transition-colors">
                                        <div className="text-xs font-mono text-slate-500 mb-4 flex justify-between">
                                            <span>{new Date(article.publishedAt!).toLocaleDateString()}</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-white mb-3 group-hover:text-primary-400 transition-colors leading-tight">
                                            {article.headline}
                                        </h3>
                                        <p className="text-slate-400 text-sm leading-relaxed mb-4 line-clamp-3">
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
                        <div className="text-center py-20 border-t border-white/10">
                            <div className="text-slate-500 font-mono text-sm">NO INTELLIGENCE PUBLISHED</div>
                        </div>
                    )}
                </div>
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
