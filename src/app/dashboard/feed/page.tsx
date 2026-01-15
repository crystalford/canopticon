import Link from 'next/link'
import { db, rawArticles, sources } from '@/db'
import { eq, desc, and } from 'drizzle-orm'
import { Radio, FileText, ArrowRight, Archive, RefreshCw, MessageSquare } from 'lucide-react'
import FeedItemCard from './FeedItemCard'
import RefreshFeedButton from './RefreshFeedButton'

export const dynamic = 'force-dynamic'

async function getRawFeed() {
    return db
        .select({
            id: rawArticles.id,
            title: rawArticles.title,
            bodyText: rawArticles.bodyText,
            publishedAt: rawArticles.publishedAt,
            createdAt: rawArticles.createdAt,
            sourceName: sources.name,
            originalUrl: rawArticles.originalUrl,
        })
        .from(rawArticles)
        .leftJoin(sources, eq(rawArticles.sourceId, sources.id))
        .where(eq(rawArticles.isProcessed, false)) // Only show unprocessed
        .orderBy(desc(rawArticles.createdAt))
        .limit(50)
}

export default async function WireServicePage() {
    const feed = await getRawFeed()

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                        <Radio className="w-8 h-8 text-red-500 animate-pulse" />
                        Raw Wire Service
                    </h1>
                    <p className="text-slate-400">
                        Live ingestion feed from direct sources.
                        <span className="text-slate-500 ml-2 text-sm">(Filtered from Daily Brief)</span>
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <RefreshFeedButton />
                    <Link href="/dashboard/manual-sources" className="btn-secondary">
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Add Source
                    </Link>
                </div>
            </div>

            {/* Feed List */}
            <div className="grid gap-4">
                {feed.length === 0 ? (
                    <div className="glass-panel p-12 text-center">
                        <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
                            <Radio className="w-8 h-8 text-slate-600" />
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2">No New Signals</h3>
                        <p className="text-slate-400 max-w-md mx-auto">
                            The wire is quiet. Check back later or trigger a manual ingestion cycle.
                        </p>
                    </div>
                ) : (
                    feed.map((item) => (
                        <FeedItemCard key={item.id} item={item} />
                    ))
                )}
            </div>
        </div>
    )
}
