
'use client'

import { useState, useEffect } from 'react'
import { Search, Database, Calendar, FileText, ExternalLink, Loader2, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { useDebounce } from '@/lib/hooks/use-debounce'

interface SearchResult {
    id: string
    headline: string
    summary: string
    publishedAt: string
    isDraft: boolean
    slug: string
    sourceName?: string
    sourceReliability?: number
}

export default function ArchivePage() {
    const [query, setQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [results, setResults] = useState<SearchResult[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [hasSearched, setHasSearched] = useState(false)

    const debouncedQuery = useDebounce(query, 500)

    const performSearch = async () => {
        setIsLoading(true)
        setHasSearched(true)
        try {
            const params = new URLSearchParams()
            if (debouncedQuery) params.set('q', debouncedQuery)
            if (statusFilter !== 'all') params.set('type', statusFilter)

            const res = await fetch(`/api/archive/search?${params.toString()}`)
            const data = await res.json()
            setResults(data.results || [])
        } catch (error) {
            console.error('Search failed', error)
        } finally {
            setIsLoading(false)
        }
    }

    // Trigger search on debounce or filter change
    useEffect(() => {
        performSearch()
    }, [debouncedQuery, statusFilter])

    return (
        <div className="space-y-6">
            <header className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Database className="w-6 h-6 text-primary-500" />
                        Intelligence Archive
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        Search and retrieve historical analysis, drafts, and source documents.
                    </p>
                </div>
            </header>

            {/* Search Bar & Filters */}
            <div className="glass-panel p-4 flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search headlines, content, or summaries..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="w-full bg-slate-900/50 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-primary-500 transition-all font-mono text-sm"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-slate-900/50 border border-white/10 rounded-lg px-4 py-2.5 text-slate-300 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                    >
                        <option value="all">All Status</option>
                        <option value="published">Published</option>
                        <option value="draft">Drafts</option>
                    </select>
                </div>
            </div>

            {/* Results */}
            <div className="space-y-2">
                {isLoading && (
                    <div className="text-center py-12 text-slate-500 flex flex-col items-center gap-3">
                        <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
                        <span className="text-xs font-mono uppercase tracking-widest">Searching Database...</span>
                    </div>
                )}

                {!isLoading && hasSearched && results.length === 0 && (
                    <div className="text-center py-12 text-slate-500">
                        No results found for your query.
                    </div>
                )}

                {!isLoading && results.map(result => (
                    <div key={result.id} className="glass-panel p-5 hover:border-primary-500/30 transition-colors group">
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${result.isDraft ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' : 'bg-green-500/10 text-green-500 border-green-500/20'}`}>
                                        {result.isDraft ? 'Draft' : 'Published'}
                                    </span>
                                    <span className="text-xs font-mono text-slate-500 flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        {new Date(result.publishedAt || Date.now()).toLocaleDateString()}
                                    </span>
                                    {result.sourceName && (
                                        <span className="text-xs text-slate-600 border px-1 rounded border-slate-700">
                                            {result.sourceName}
                                        </span>
                                    )}
                                </div>

                                <h3 className="text-lg font-bold text-white mb-2 group-hover:text-primary-400 transition-colors">
                                    {result.headline}
                                </h3>
                                <p className="text-slate-400 text-sm line-clamp-2 mb-4">
                                    {result.summary}
                                </p>

                                <div className="flex items-center gap-4">
                                    <Link href={`/dashboard/articles/${result.slug}`} className="text-xs font-bold text-primary-400 flex items-center gap-1 hover:underline">
                                        OPEN DOSSIER <ArrowRight className="w-3 h-3" />
                                    </Link>
                                    <Link href={`/articles/${result.slug}`} target="_blank" className="text-slate-500 hover:text-white transition-colors">
                                        <ExternalLink className="w-4 h-4" />
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
