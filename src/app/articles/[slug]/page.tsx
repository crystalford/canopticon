import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/db'
import { articles } from '@/db/schema'
import { eq, and, desc } from 'drizzle-orm'
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
        openGraph: {
            title: article.title,
            description: article.summary || article.title,
            type: 'article',
            publishedTime: article.publishedAt?.toISOString(),
            authors: [article.author],
            tags: article.tags,
        },
        twitter: {
            card: 'summary_large_image',
            title: article.title,
            description: article.summary || article.title,
        },
    }
}

function stripLeadingTitle(content: string): string {
    return content.replace(/^#\s+.+\n+/, '')
}

export default async function ArticlePage({ params }: PageProps) {
    const article = await db.query.articles.findFirst({
        where: and(eq(articles.slug, params.slug), eq(articles.status, 'published')),
    })

    if (!article) notFound()

    // Find related articles by shared tags
    let relatedArticles: typeof allPublished = []
    const allPublished = await db.query.articles.findMany({
        where: eq(articles.status, 'published'),
        columns: { id: true, title: true, slug: true, summary: true, tags: true },
        orderBy: [desc(articles.publishedAt)],
    })
    if (article.tags?.length) {
        relatedArticles = allPublished
            .filter(a => a.id !== article.id && a.tags?.some(t => article.tags?.includes(t)))
            .slice(0, 3)
    }

    // JSON-LD structured data
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'NewsArticle',
        headline: article.title,
        description: article.summary,
        datePublished: article.publishedAt?.toISOString(),
        author: { '@type': 'Organization', name: article.author },
        publisher: { '@type': 'Organization', name: 'CANOPTICON' },
        keywords: article.tags?.join(', '),
    }

    const cleanContent = stripLeadingTitle(article.content)

    return (
        <div className="min-h-screen">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />

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
                        {/* Tags */}
                        {article.tags?.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-4">
                                {article.tags.map(tag => (
                                    <Link
                                        key={tag}
                                        href={`/?tag=${encodeURIComponent(tag)}`}
                                        className="text-xs px-2.5 py-1 rounded-full bg-primary-500/10 text-primary-400 border border-primary-500/20 hover:bg-primary-500/20 transition-colors"
                                    >
                                        {tag}
                                    </Link>
                                ))}
                            </div>
                        )}
                    </header>

                    <div className="prose prose-invert prose-lg max-w-none">
                        <ReactMarkdown>{cleanContent}</ReactMarkdown>
                    </div>
                </article>

                {/* Related Articles */}
                {relatedArticles.length > 0 && (
                    <div className="mt-12 pt-8 border-t border-white/5">
                        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Related Articles</h3>
                        <div className="space-y-3">
                            {relatedArticles.map(related => (
                                <Link
                                    key={related.id}
                                    href={`/articles/${related.slug}`}
                                    className="block glass-card p-4 hover:bg-white/5 transition-colors"
                                >
                                    <h4 className="text-white font-medium mb-1">{related.title}</h4>
                                    {related.summary && (
                                        <p className="text-sm text-slate-400 line-clamp-2">{related.summary}</p>
                                    )}
                                    {related.tags?.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {related.tags.slice(0, 4).map(tag => (
                                                <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-slate-500">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

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
