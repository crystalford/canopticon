import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/db'
import { articles } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import ReactMarkdown from 'react-markdown'

export const revalidate = 60

interface PageProps {
    params: { slug: string }
}

export async function generateMetadata({ params }: PageProps) {
    const article = await db.query.articles.findFirst({
        where: and(eq(articles.slug, params.slug), eq(articles.status, 'published')),
    })

    if (!article) return { title: 'Not Found' }

    return {
        title: `${article.title} | CANOPTICON`,
        description: article.summary || article.title,
    }
}

export default async function ArticlePage({ params }: PageProps) {
    const article = await db.query.articles.findFirst({
        where: and(eq(articles.slug, params.slug), eq(articles.status, 'published')),
    })

    if (!article) notFound()

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

            {/* Article */}
            <main className="max-w-3xl mx-auto px-6 py-12">
                <article>
                    <header className="mb-8">
                        <h1 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
                            {article.title}
                        </h1>
                        {article.summary && (
                            <p className="text-lg text-slate-400 mb-4">{article.summary}</p>
                        )}
                        <div className="flex items-center gap-3 text-sm text-slate-500">
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
                    </header>

                    <div className="prose prose-invert prose-lg max-w-none">
                        <ReactMarkdown>{article.content}</ReactMarkdown>
                    </div>
                </article>

                {/* Back link */}
                <div className="mt-12 pt-8 border-t border-white/5">
                    <Link
                        href="/"
                        className="text-sm text-slate-400 hover:text-white transition-colors"
                    >
                        &larr; Back to all articles
                    </Link>
                </div>
            </main>
        </div>
    )
}
