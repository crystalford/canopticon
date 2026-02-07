import Link from 'next/link'
import { db } from '@/db'
import { articles } from '@/db/schema'
import { desc, eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
    let publishedArticles: any[] = []
    try {
        publishedArticles = await db.query.articles.findMany({
            where: eq(articles.status, 'published'),
            orderBy: [desc(articles.publishedAt)],
            limit: 20,
        })
    } catch {
        // DB not available during build
    }

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
                {publishedArticles.length === 0 ? (
                    <div className="text-center py-20">
                        <h2 className="text-2xl font-bold text-white mb-4">No articles yet</h2>
                        <p className="text-slate-400 mb-6">
                            Go to the dashboard and start publishing.
                        </p>
                        <Link href="/dashboard" className="btn-primary">
                            Open Dashboard
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
                                        <div className="flex items-center gap-3 text-xs text-slate-500">
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
