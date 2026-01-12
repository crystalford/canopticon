import { useState, useEffect } from 'react'
import { Trend } from '@/types'
import { ingestTrendsAction, getTrendsAction, generateTrendResponseAction } from '@/app/actions'
import { RefreshCw, TrendingUp, Search, PlusCircle, Zap, Send, X } from 'lucide-react'
import { toast } from 'sonner'
import { AnimatePresence, motion } from 'framer-motion'

export default function TrendStream() {
    const [trends, setTrends] = useState<Trend[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Engagement State
    const [activeTrendId, setActiveTrendId] = useState<string | null>(null);
    const [draft, setDraft] = useState("");
    const [generating, setGenerating] = useState(false);

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

    const handleEngage = async (trend: Trend) => {
        if (activeTrendId === trend.id) {
            setActiveTrendId(null);
            return;
        }

        setActiveTrendId(trend.id);
        setGenerating(true);
        setDraft("");

        try {
            const result = await generateTrendResponseAction(trend.topic, trend.domain || 'General', trend.sentiment || 0);
            if (result.success && result.draft) {
                setDraft(result.draft);
            } else {
                toast.error("Failed to generate take");
                setActiveTrendId(null);
            }
        } catch (e) {
            toast.error("AI Error");
            setActiveTrendId(null);
        } finally {
            setGenerating(false);
        }
    }

    const handlePostToX = () => {
        if (!draft) return;
        const text = encodeURIComponent(draft);
        window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
        toast.success("Opened Twitter Composer");
        setActiveTrendId(null);
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
                            <div key={trend.id} className="group transition-colors hover:bg-white/[0.02]">
                                <div className="p-4 flex items-center justify-between">
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
                                        <button
                                            onClick={() => handleEngage(trend)}
                                            className={`p-2 rounded-lg transition-colors border ${activeTrendId === trend.id ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50' : 'hover:bg-yellow-500/20 text-gray-400 hover:text-yellow-400 border-transparent hover:border-yellow-500/30'}`}
                                            title="Generate Hot Take"
                                        >
                                            <Zap className="w-4 h-4" />
                                        </button>
                                        <button className="p-2 hover:bg-purple-500/20 text-gray-400 hover:text-purple-400 rounded-lg transition-colors border border-transparent hover:border-purple-500/30" title="Deep Research">
                                            <Search className="w-4 h-4" />
                                        </button>
                                        <button className="p-2 hover:bg-green-500/20 text-gray-400 hover:text-green-400 rounded-lg transition-colors border border-transparent hover:border-green-500/30" title="Create Signal">
                                            <PlusCircle className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Engagement Draft Area */}
                                <AnimatePresence>
                                    {activeTrendId === trend.id && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="px-4 pb-4 overflow-hidden"
                                        >
                                            <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                                                {generating ? (
                                                    <div className="flex items-center justify-center py-4 text-sm text-gray-400 gap-2">
                                                        <Zap className="w-4 h-4 animate-pulse text-yellow-500" />
                                                        Creating Hot Take...
                                                    </div>
                                                ) : (
                                                    <>
                                                        <textarea
                                                            value={draft}
                                                            onChange={(e) => setDraft(e.target.value)}
                                                            className="w-full bg-black/50 border border-white/10 rounded p-2 text-sm text-gray-200 focus:outline-none focus:border-yellow-500/50 mb-3"
                                                            rows={3}
                                                        />
                                                        <div className="flex justify-end gap-2">
                                                            <button
                                                                onClick={() => setActiveTrendId(null)}
                                                                className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors"
                                                            >
                                                                Cancel
                                                            </button>
                                                            <button
                                                                onClick={handlePostToX}
                                                                className="px-3 py-1.5 bg-[#1DA1F2]/20 border border-[#1DA1F2]/50 text-[#1DA1F2] rounded hover:bg-[#1DA1F2]/30 transition-colors flex items-center gap-2 text-xs font-bold"
                                                            >
                                                                <Send className="w-3 h-3" />
                                                                Post to X
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
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
