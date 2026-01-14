import { db, articles } from '@/db'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

interface PageProps {
    params: Promise<{ slug: string }>
}

// Generate metadata for SEO
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { slug } = await params
    const [article] = await db
        .select()
        .from(articles)
        .where(eq(articles.slug, slug))
        .limit(1)

    if (!article || article.isDraft) {
        return {
            title: 'Article Not Found'
        }
    }

    return {
        title: article.headline,
        description: article.metaDescription || article.excerpt || article.summary.slice(0, 160),
        openGraph: {
            title: article.headline,
            description: article.metaDescription || article.excerpt || article.summary.slice(0, 160),
            type: 'article',
            publishedTime: article.publishedAt?.toISOString(),
            authors: [article.author],
            images: article.featuredImageUrl ? [article.featuredImageUrl] : [],
        },
        twitter: {
            card: 'summary_large_image',
            title: article.headline,
            description: article.metaDescription || article.excerpt || article.summary.slice(0, 160),
            images: article.featuredImageUrl ? [article.featuredImageUrl] : [],
        },
    }
}

// Helper to render TipTap JSON as HTML
function renderTipTapContent(content: any) {
    if (!content || !content.content) return null

    return content.content.map((node: any, index: number) => {
        switch (node.type) {
            case 'paragraph':
                return (
                    <p key={index} className="mb-4 text-lg text-slate-700 dark:text-slate-300 leading-relaxed">
                        {node.content?.map((inline: any, i: number) => renderInline(inline, i))}
                    </p>
                )
            case 'heading':
                const Tag = `h${node.attrs.level}` as keyof JSX.IntrinsicElements
                return (
                    <Tag key={index} className="font-bold text-slate-900 dark:text-white mt-8 mb-4">
                        {node.content?.map((inline: any, i: number) => renderInline(inline, i))}
                    </Tag>
                )
            case 'bulletList':
                return (
                    <ul key={index} className="list-disc list-inside mb-4 space-y-2">
                        {node.content?.map((item: any, i: number) => (
                            <li key={i} className="text-slate-700 dark:text-slate-300">
                                {item.content?.[0]?.content?.map((inline: any, j: number) => renderInline(inline, j))}
                            </li>
                        ))}
                    </ul>
                )
            case 'orderedList':
                return (
                    <ol key={index} className="list-decimal list-inside mb-4 space-y-2">
                        {node.content?.map((item: any, i: number) => (
                            <li key={i} className="text-slate-700 dark:text-slate-300">
                                {item.content?.[0]?.content?.map((inline: any, j: number) => renderInline(inline, j))}
                            </li>
                        ))}
                    </ol>
                )
            case 'blockquote':
                return (
                    <blockquote key={index} className="border-l-4 border-primary-500 pl-4 italic my-4 text-slate-600 dark:text-slate-400">
                        {node.content?.map((child: any, i: number) => renderTipTapContent({ content: [child] }))}
                    </blockquote>
                )
            case 'image':
                return (
                    <img
                        key={index}
                        src={node.attrs.src}
                        alt={node.attrs.alt || ''}
                        className="max-w-full h-auto rounded-lg my-6"
                    />
                )
            default:
                return null
        }
    })
}

function renderInline(node: any, index: number) {
    if (node.type === 'text') {
        let text = node.text
        if (node.marks) {
            node.marks.forEach((mark: any) => {
                if (mark.type === 'bold') {
                    text = <strong key={index}>{text}</strong>
                } else if (mark.type === 'italic') {
                    text = <em key={index}>{text}</em>
                } else if (mark.type === 'link') {
                    text = (
                        <a key={index} href={mark.attrs.href} className="text-primary-600 hover:underline" target="_blank" rel="noopener noreferrer">
                            {text}
                        </a>
                    )
                }
            })
        }
        return text
    }
    return null
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
        <div className="min-h-screen bg-white dark:bg-slate-950">
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
                    {/* Featured Image */}
                    {article.featuredImageUrl && (
                        <img
                            src={article.featuredImageUrl}
                            alt={article.headline}
                            className="w-full h-auto rounded-xl mb-8 shadow-lg"
                        />
                    )}

                    {/* Meta */}
                    <div className="mb-8">
                        <div className="flex items-center gap-4 mb-4 text-sm text-slate-500 dark:text-slate-400">
                            {article.publishedAt && (
                                <time>
                                    {new Date(article.publishedAt).toLocaleDateString('en-CA', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                    })}
                                </time>
                            )}
                            <span>•</span>
                            <span>By {article.author}</span>
                            {article.readingTime && (
                                <>
                                    <span>•</span>
                                    <span>{article.readingTime} min read</span>
                                </>
                            )}
                        </div>
                        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-4">
                            {article.headline}
                        </h1>
                        {article.excerpt && (
                            <p className="text-xl text-slate-600 dark:text-slate-400 leading-relaxed">
                                {article.excerpt}
                            </p>
                        )}

                        {/* Topics */}
                        {article.topics && article.topics.length > 0 && (
                            <div className="flex gap-2 flex-wrap mt-4">
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

                    {/* Content (Rich Text or Summary fallback) */}
                    <div className="prose prose-lg max-w-none">
                        {article.content ? (
                            renderTipTapContent(typeof article.content === 'string' ? JSON.parse(article.content) : article.content)
                        ) : (
                            article.summary.split('\n').map((paragraph, i) => (
                                <p key={i} className="mb-4 text-lg text-slate-700 dark:text-slate-300 leading-relaxed">
                                    {paragraph}
                                </p>
                            ))
                        )}
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

            {/* Structured Data for Google News */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        '@context': 'https://schema.org',
                        '@type': 'NewsArticle',
                        headline: article.headline,
                        image: article.featuredImageUrl ? [article.featuredImageUrl] : [],
                        datePublished: article.publishedAt?.toISOString(),
                        dateModified: article.updatedAt?.toISOString() || article.publishedAt?.toISOString(),
                        author: {
                            '@type': 'Organization',
                            name: article.author,
                        },
                        publisher: {
                            '@type': 'Organization',
                            name: 'CANOPTICON',
                            logo: {
                                '@type': 'ImageObject',
                                url: 'https://canopticon.com/logo.png',
                            },
                        },
                    }),
                }}
            />
        </div>
    )
}
