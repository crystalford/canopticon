
import Link from 'next/link'
import { db, articles } from '@/db'
import { eq, desc, arrayContains } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import Logo from '@/components/Logo'
import { ArrowLeft, Hash } from 'lucide-react'

export const dynamic = 'force-dynamic'

async function getArticlesByTopic(topicSlug: string) {
    // Basic un-slugify: "federal-politics" -> "Federal Politics"
    // Ideally we'd store topics as a separate table, but for now we search the array
    // This is a "fuzzy" match because we are reconstructing the original string
    // In a real app we'd have a taxonomy table. 
    // For now, we will fetch ALL articles and filter (since dataset is small) 
    // OR we rely on the exact string match if the slug is passed effectively.

    // Better approach given current schema (topics is text[]):
    // We can't easily query "topic matches slug" without normalization in DB.
    // So we fetch everything and filter in JS for this MVP phase.

    const allArticles = await db
        .select()
        .from(articles)
        .where(eq(articles.isDraft, false))
        .orderBy(desc(articles.publishedAt))

    const decodedTopic = decodeURIComponent(topicSlug).replace(/-/g, ' ').toLowerCase()

    return allArticles.filter(a =>
        a.topics?.some(t => t.toLowerCase() === decodedTopic)
    )
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
    const topicName = decodeURIComponent(params.slug).replace(/-/g, ' ').toUpperCase()
    return {
        title: `${topicName} - Canopticon Intelligence`,
        description: `Analysis and reporting on ${topicName} from primary sources.`,
    }
}

export default async function TopicPage({ params }: { params: { slug: string } }) {
    const topicArticles = await getArticlesByTopic(params.slug)
    const topicName = decodeURIComponent(params.slug).replace(/-/g, ' ')

    if (topicArticles.length === 0) {
        // Optional: show 404 or just "No articles found"
        // notFound() 
        // Keeping it valid so we can see the "No Data" state if accessed manually
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

            <main className="max-w-4xl mx-auto px-6 py-20">
                <Link href="/" className="inline-flex items-center text-sm text-slate-500 hover:text-white transition-colors mb-8">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Feed
                </Link>

                <div className="flex items-center gap-4 mb-12">
                    <div className="p-4 rounded-2xl bg-primary-500/10 border border-primary-500/20 text-primary-400">
                        <Hash className="w-8 h-8" />
                    </div>
                    <div>
                        <div className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-1">
                            Topic Analysis
                        </div>
                        <h1 className="text-4xl font-bold text-white capitalize">
                            {topicName}
                        </h1>
                    </div>
                </div>

                <div className="space-y-8">
                    {topicArticles.length === 0 ? (
                        <div className="text-center py-20 border border-dashed border-white/10 rounded-xl">
                            <p className="text-slate-500">No intelligence reports found for this topic.</p>
                        </div>
                    ) : (
                        topicArticles.map(article => (
                            <Link
                                key={article.id}
                                href={`/articles/${article.slug}`}
                                className="block group border-b border-white/5 pb-8 last:border-0"
                            >
                                <div className="flex items-center gap-3 text-xs font-mono text-slate-500 mb-2">
                                    <span>{new Date(article.publishedAt!).toLocaleDateString()}</span>
                                    <span className="w-px h-3 bg-slate-800" />
                                    <span>{article.readingTime} MIN READ</span>
                                </div>
                                <h2 className="text-2xl font-bold text-white mb-3 group-hover:text-primary-400 transition-colors">
                                    {article.headline}
                                </h2>
                                <p className="text-slate-400 leading-relaxed max-w-2xl">
                                    {article.excerpt || article.summary}
                                </p>
                            </Link>
                        ))
                    )}
                </div>
            </main>
        </div>
    )
}
