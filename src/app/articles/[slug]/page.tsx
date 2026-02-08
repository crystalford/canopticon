import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/db'
import { articles } from '@/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import { Navigation } from '@/components/Navigation'
import { Footer } from '@/components/Footer'

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

function renderYouTubeEmbeds(content: string): string {
    return content.replace(/<youtube>([\w-]+)<\/youtube>/g, (_match, videoId) =>
        `<iframe width="100%" height="400" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="border-radius: 8px; margin: 1em 0;"></iframe>`
    )
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

    const cleanContent = renderYouTubeEmbeds(stripLeadingTitle(article.content))

    return (
        <div className="min-h-screen relative">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />

            {/* Ambient background effects */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-red-500/[0.07] rounded-full blur-[120px]" />
                <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-red-900/[0.05] rounded-full blur-[100px]" />
            </div>

            <Navigation />

            {/* Article */}
            <main className="relative z-10 max-w-4xl mx-auto px-6 py-12">
                <article>
                    <header className="mb-10">
                        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-5 leading-tight">
                            {article.title}
                        </h1>
                        {article.summary && (
                            <p className="text-lg text-slate-400 mb-5 leading-relaxed">{article.summary}</p>
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
                            <div className="flex flex-wrap gap-2 mt-5">
                                {article.tags.map(tag => (
                                    <Link
                                        key={tag}
                                        href={`/articles?tag=${encodeURIComponent(tag)}`}
                                        className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
                                    >
                                        {tag}
                                    </Link>
                                ))}
                            </div>
                        )}
                    </header>

                    <div className="prose prose-invert prose-lg max-w-none">
                        <ReactMarkdown rehypePlugins={[rehypeRaw]}>{cleanContent}</ReactMarkdown>
                    </div>
                </article>

                {/* Related Articles */}
                {relatedArticles.length > 0 && (
                    <div className="mt-16 pt-10 border-t border-white/[0.06]">
                        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-6">Related Articles</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {relatedArticles.map(related => (
                                <Link
                                    key={related.id}
                                    href={`/articles/${related.slug}`}
                                    className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 hover:border-white/[0.12] hover:bg-white/[0.04] transition-all duration-300"
                                >
                                    <h4 className="text-white font-semibold mb-2 leading-snug">{related.title}</h4>
                                    {related.summary && (
                                        <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed">{related.summary}</p>
                                    )}
                                    {related.tags?.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {related.tags.slice(0, 4).map(tag => (
                                                <span key={tag} className="text-xs px-2 py-0.5 rounded bg-white/[0.04] text-slate-600">
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
                <div className="mt-16 pt-10 border-t border-white/[0.06]">
                    <Link
                        href="/articles"
                        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
                    >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M10 12L6 8l4-4" />
                        </svg>
                        Back to all articles
                    </Link>
                </div>
            </main>

            <Footer />
        </div>
    )
}
