"use client"

import { useState, useEffect } from 'react'
import { Trend } from '@/types'
import { ingestTrendsAction, getTrendsAction } from '@/app/actions'
import { RefreshCw, TrendingUp, Search, PlusCircle } from 'lucide-react'
import { toast } from 'sonner'

export default function TrendStream() {
    const [trends, setTrends] = useState<Trend[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadTrends = async () => {
        const data = await getTrendsAction();
        setTrends(data as Trend[]);
        setLoading(false);
    }

    const handleRefresh = async () => {
        setRefreshing(true);
        const toastId = toast.loading("Scanning social sphere...");
        try {
            const result = await ingestTrendsAction();
            if (result.success) {
                await loadTrends();
                toast.success(`Ingested ${result.count} new trends`, { id: toastId });
            } else {
                toast.error("Ingest failed: " + result.error, { id: toastId });
            }
        } catch (e) {
            toast.error("Network error", { id: toastId });
        } finally {
            setRefreshing(false);
        }
    }

    useEffect(() => {
        loadTrends();
    }, []);

    return (
        <div className="bg-black/40 border border-white/10 rounded-xl overflow-hidden backdrop-blur-md">
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                <div className="flex items-center gap-2 text-cyan-400">
                    <TrendingUp className="w-5 h-5" />
                    <h2 className="font-bold tracking-wide">LIVE TREND STREAM</h2>
                </div>
                <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors disabled:opacity-50"
                >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Content */}
            <div className="p-0">
                {loading ? (
                    <div className="p-8 text-center text-gray-500 animate-pulse">Connecting to global feed...</div>
                ) : (
                    <div className="divide-y divide-white/5">
                        {trends.map((trend) => (
                            <div key={trend.id} className="p-4 hover:bg-white/[0.02] flex items-center justify-between group transition-colors">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-white font-bold text-lg">{trend.topic}</span>
                                        {trend.domain && (
                                            <span className="text-[10px] uppercase tracking-wider bg-white/10 px-2 py-0.5 rounded text-gray-400">
                                                {trend.domain}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-4 text-xs text-gray-500">
                                        <span>Vol: {(trend.volume / 1000).toFixed(1)}k</span>
                                        {trend.sentiment !== undefined && (
                                            <span className={`${trend.sentiment < 0 ? 'text-red-400' : 'text-green-400'}`}>
                                                {trend.sentiment > 0 ? '+' : ''}{trend.sentiment.toFixed(2)} Sentiment
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button className="p-2 hover:bg-purple-500/20 text-gray-400 hover:text-purple-400 rounded-lg transition-colors border border-transparent hover:border-purple-500/30" title="Deep Research">
                                        <Search className="w-4 h-4" />
                                    </button>
                                    <button className="p-2 hover:bg-green-500/20 text-gray-400 hover:text-green-400 rounded-lg transition-colors border border-transparent hover:border-green-500/30" title="Create Signal">
                                        <PlusCircle className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {trends.length === 0 && (
                            <div className="p-8 text-center text-gray-500">
                                No trends active. Click refresh to scan.
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
