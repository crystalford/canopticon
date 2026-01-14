import { db, articles } from '@/db'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

interface PageProps {
    params: Promise<{ slug: string }>
}

export default async function ArticlePage({ params }: PageProps) {
    const { slug } = await params

    const [article] = await db
        .select()
        .from(articles)
        .where(eq(articles.slug, slug))
        .limit(1)

    if (!article || article.isDraft) {
        notFound()
    }

    return (
        <div className="min-h-screen">
            {/* Header */}
            <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <Link href="/" className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-sm">C</span>
                            </div>
                            <span className="font-semibold text-xl tracking-tight">CANOPTICON</span>
                        </Link>
                    </div>
                </div>
            </header>

            {/* Article */}
            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <article>
                    {/* Meta */}
                    <div className="mb-8">
                        {article.publishedAt && (
                            <time className="text-sm text-slate-500 dark:text-slate-400">
                                {new Date(article.publishedAt).toLocaleDateString('en-CA', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                })}
                            </time>
                        )}
                        <h1 className="text-4xl font-bold text-slate-900 dark:text-white mt-2 mb-4">
                            {article.headline}
                        </h1>

                        {/* Topics */}
                        {article.topics && article.topics.length > 0 && (
                            <div className="flex gap-2 flex-wrap">
                                {article.topics.map(topic => (
                                    <span
                                        key={topic}
                                        className="px-3 py-1 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 rounded-full text-sm"
                                    >
                                        {topic}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Summary */}
                    <div className="prose-canopticon">
                        {article.summary.split('\n').map((paragraph, i) => (
                            <p key={i} className="mb-4 text-slate-700 dark:text-slate-300 leading-relaxed">
                                {paragraph}
                            </p>
                        ))}
                    </div>

                    {/* Entities */}
                    {article.entities && article.entities.length > 0 && (
                        <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-700">
                            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
                                Key Entities
                            </h2>
                            <div className="flex gap-2 flex-wrap">
                                {article.entities.map(entity => (
                                    <span
                                        key={entity}
                                        className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-sm"
                                    >
                                        {entity}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </article>

                {/* Back link */}
                <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-700">
                    <Link
                        href="/"
                        className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium"
                    >
                        ← Back to all articles
                    </Link>
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-slate-200 dark:border-slate-800 py-8 px-4 sm:px-6 lg:px-8 mt-auto">
                <div className="max-w-4xl mx-auto text-center text-slate-500 dark:text-slate-400 text-sm">
                    <p>© 2026 CANOPTICON. Primary-source political synthesis.</p>
                </div>
            </footer>
        </div>
    )
}
