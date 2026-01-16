import { notFound } from 'next/navigation'
import Link from 'next/link'
import { db, articles } from '@/db'
import { eq } from 'drizzle-orm'
import { Metadata } from 'next'
import { ChevronLeft, Calendar, Clock, Share2 } from 'lucide-react'
import Logo from '@/components/Logo'
import dynamic from 'next/dynamic'

const ArticleContent = dynamic(() => import('@/components/ArticleContent'), { ssr: false })

export const revalidate = 60

async function getArticle(slug: string) {
    const result = await db.select().from(articles).where(eq(articles.slug, slug))
    return result[0]
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
    const article = await getArticle(params.slug)
    if (!article) return { title: 'Not Found' }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://canopticon.com'
    const ogUrl = new URL(`${siteUrl}/api/og`)
    ogUrl.searchParams.set('title', article.headline)

    // Safely handle date
    try {
        if (article.publishedAt) {
            ogUrl.searchParams.set('date', new Date(article.publishedAt).toLocaleDateString())
        }
    } catch (e) {
        // Ignore date parsing error for OG 
    }

    if (article.readingTime) {
        ogUrl.searchParams.set('readTime', article.readingTime.toString())
    }

    const isoDate = article.publishedAt ? new Date(article.publishedAt).toISOString() : undefined

    return {
        title: article.headline,
        description: article.metaDescription || article.summary,
        openGraph: {
            title: article.headline,
            description: article.metaDescription || article.summary,
            type: 'article',
            publishedTime: isoDate,
            authors: [article.author || 'CANOPTICON'],
            images: [ogUrl.toString()],
        },
        twitter: {
            card: 'summary_large_image',
            title: article.headline,
            description: article.metaDescription || article.summary,
            images: [ogUrl.toString()],
        },
    }
}

export default async function ArticlePage({ params }: { params: { slug: string } }) {
    const article = await getArticle(params.slug)
    if (!article) notFound()

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://canopticon.com'
    const schemaDatePublished = article.publishedAt ? new Date(article.publishedAt).toISOString() : new Date().toISOString()
    const schemaDateModified = article.updatedAt ? new Date(article.updatedAt).toISOString() : new Date().toISOString()

    const schemaData = {
        '@context': 'https://schema.org',
        '@type': 'NewsArticle',
        headline: article.headline,
        description: article.metaDescription || article.summary,
        image: article.featuredImageUrl ? [article.featuredImageUrl] : [],
        datePublished: schemaDatePublished,
        dateModified: schemaDateModified,
        author: [{
            '@type': 'Person',
            name: article.author || 'Canopticon Analyst',
            url: siteUrl
        }],
        publisher: {
            '@type': 'Organization',
            name: 'Canopticon',
            logo: {
                '@type': 'ImageObject',
                url: `${siteUrl}/icon`
            }
        }
    }

    return (
        <div className="min-h-screen bg-background text-slate-300 selection:bg-primary-500/30">
            {/* Header */}
            <header className="border-b border-white/5 bg-black/20 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
                    <Link href="/">
                        <Logo className="scale-90" />
                    </Link>
                </div>
            </header>

            {/* Structured Data (JSON-LD) for Google News */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(schemaData)
                }}
            />

            <article className="max-w-3xl mx-auto px-6 py-12">
                {/* Meta Header */}
                <div className="mb-8 space-y-4">
                    <div className="flex items-center gap-4 text-sm text-slate-400 font-mono">
                        <span className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            {article.publishedAt ? new Date(article.publishedAt).toLocaleDateString() : 'Draft'}
                        </span>
                        <span className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            {article.readingTime || 5} min read
                        </span>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-4">
                        {article.topics?.map((topic: string) => (
                            <Link key={topic} href={`/topics/${topic.toLowerCase().replace(/\s+/g, '-')}`} className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary-500/10 text-primary-400 border border-primary-500/20 uppercase tracking-wider shadow-[0_0_10px_rgba(239,68,68,0.2)] hover:bg-primary-500/20 transition-colors">
                                {topic}
                            </Link>
                        ))}
                    </div>

                    <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight tracking-tight">
                        {article.headline}
                    </h1>



                    {/* Author Block */}
                    <div className="flex items-center gap-3 pt-4 border-t border-white/5">
                        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 font-bold">
                            {article.author?.[0] || 'C'}
                        </div>
                        <div>
                            <div className="text-sm font-bold text-white">{article.author}</div>
                            <div className="text-xs text-primary-400 uppercase tracking-wider">Intelligence Analyst</div>
                        </div>
                    </div>
                </div>



                {/* Main Content */}
                <div className="min-h-[200px]">
                    <ArticleContent content={article.content} />
                </div>

                {/* Footer */}
                <div className="mt-16 pt-8 border-t border-white/10 flex justify-between items-center">
                    <Link href="/" className="text-primary-400 hover:text-white transition-colors flex items-center gap-2">
                        <ChevronLeft className="w-4 h-4" />
                        Back to Intelligence
                    </Link>
                    <button className="p-2 rounded-full hover:bg-white/5 text-slate-400 hover:text-white transition-colors">
                        <Share2 className="w-5 h-5" />
                    </button>
                </div>
            </article>
        </div>
    )
}
