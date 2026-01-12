"use client"

import { useState, useEffect, useCallback } from 'react'
import { Signal } from '@/types'
import { Check, X, SkipForward, ExternalLink, RefreshCw } from 'lucide-react'
import { updateSignalStatusAction } from '@/app/actions'
import { useRouter } from 'next/navigation'

interface ReviewQueueProps {
    initialSignals: any[]
}

export default function ReviewQueue({ initialSignals }: ReviewQueueProps) {
    const [queue, setQueue] = useState<any[]>(initialSignals);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [processing, setProcessing] = useState(false);
    const router = useRouter();

    const currentSignal = queue[currentIndex];

    const handleAction = useCallback(async (action: 'approve' | 'reject' | 'skip') => {
        if (!currentSignal || processing) return;
        setProcessing(true);

        // Optimistic UI Update
        const nextIndex = currentIndex + 1;

        // Perform server action
        let status: 'processed' | 'archived' | 'pending' = 'pending';
        if (action === 'approve') status = 'approved'; // "Processed" / "Approved"
        if (action === 'reject') status = 'archived';

        if (action !== 'skip') {
            try {
                // @ts-ignore
                await updateSignalStatusAction(currentSignal.hash || currentSignal.id, status);
            } catch (e) {
                console.error("Action failed", e);
                alert("Failed to update status");
                setProcessing(false);
                return;
            }
        }

        // Remove from queue (client-side)
        setQueue(prev => prev.filter((_, i) => i !== currentIndex));
        // Index stays same since we removed item, unless we are empty
        setProcessing(false);

    }, [currentSignal, currentIndex, processing]);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (processing) return;

            if (e.key.toLowerCase() === 'a' || e.key === 'ArrowRight') {
                handleAction('approve');
            } else if (e.key.toLowerCase() === 'r' || e.key === 'Delete' || e.key === 'x') {
                handleAction('reject');
            } else if (e.key.toLowerCase() === 's' || e.key === 'ArrowDown') {
                handleAction('skip');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleAction, processing]);


    if (queue.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-4">
                <div className="p-4 bg-white/5 rounded-full">
                    <Check className="w-12 h-12 text-green-500" />
                </div>
                <h2 className="text-xl font-medium">All Caught Up</h2>
                <p>No pending signals to review.</p>
                <button onClick={() => router.refresh()} className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm text-gray-300 transition-colors">
                    <RefreshCw className="w-4 h-4" /> Refresh
                </button>
            </div>
        )
    }

    // Source Info
    const sourceName = currentSignal.sources?.name || currentSignal.source || 'Unknown';
    const reliability = currentSignal.sources?.reliability_score ? Math.round(currentSignal.sources.reliability_score * 100) : null;
    const isReliable = reliability && reliability > 80;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full pb-8">
            {/* LEFT: SIGNAL CARD (Focus) */}
            <div className="flex flex-col gap-6">
                <div className="relative group perspective">
                    <div className="p-8 rounded-3xl bg-white/[0.05] border border-white/10 shadow-2xl backdrop-blur-3xl min-h-[400px] flex flex-col transition-all duration-300 transform hover:scale-[1.01] hover:bg-white/[0.07]">

                        {/* Header */}
                        <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full ${isReliable ? 'bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.5)]' : 'bg-yellow-400'}`} />
                                <span className="text-sm font-mono text-cyan-400 uppercase tracking-widest">{sourceName}</span>
                                {reliability && <span className="text-xs bg-white/10 px-1.5 py-0.5 rounded text-gray-400">{reliability}% Trust</span>}
                            </div>
                            <span className="text-xs text-gray-500 font-mono">{new Date(currentSignal.publishedAt || currentSignal.created_at).toLocaleTimeString()}</span>
                        </div>

                        {/* Content */}
                        <h1 className="text-3xl font-bold leading-tight mb-6 text-white selection:bg-purple-500/30">
                            {currentSignal.headline}
                        </h1>

                        <p className="text-lg text-gray-300 leading-relaxed mb-8 flex-1 overflow-y-auto max-h-[400px] custom-scrollbar selection:bg-purple-500/30">
                            {currentSignal.summary || currentSignal.ai_summary || "No summary available."}
                        </p>

                        {/* Footer / Meta */}
                        <div className="mt-auto pt-6 border-t border-white/5 flex gap-2 flex-wrap">
                            {currentSignal.entities?.map((e: string, i: number) => (
                                <span key={i} className="px-2 py-1 bg-white/5 rounded text-xs text-gray-400 border border-white/5">{e}</span>
                            ))}
                            <a href={currentSignal.url} target="_blank" rel="noopener noreferrer" className="ml-auto flex items-center gap-1 text-sm text-cyan-400 hover:text-cyan-300 transition-colors">
                                Original Source <ExternalLink className="w-3 h-3" />
                            </a>
                        </div>
                    </div>

                    {/* Visual Flair handling status processing overlay if needed */}
                </div>

                {/* CONTROLS */}
                <div className="grid grid-cols-3 gap-4">
                    <button
                        onClick={() => handleAction('reject')}
                        className="group flex flex-col items-center justify-center p-6 rounded-2xl bg-red-500/5 border border-red-500/20 hover:bg-red-500/10 hover:border-red-500/40 transition-all duration-200">
                        <div className="p-3 bg-red-500/10 rounded-full mb-2 group-hover:scale-110 transition-transform">
                            <X className="w-6 h-6 text-red-500" />
                        </div>
                        <span className="font-semibold text-red-400">Reject [R]</span>
                    </button>

                    <button
                        onClick={() => handleAction('skip')}
                        className="group flex flex-col items-center justify-center p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-200">
                        <div className="p-3 bg-white/5 rounded-full mb-2 group-hover:scale-110 transition-transform">
                            <SkipForward className="w-6 h-6 text-gray-400" />
                        </div>
                        <span className="font-semibold text-gray-400">Skip [S]</span>
                    </button>

                    <button
                        onClick={() => handleAction('approve')}
                        className="group flex flex-col items-center justify-center p-6 rounded-2xl bg-cyan-500/5 border border-cyan-500/20 hover:bg-cyan-500/10 hover:border-cyan-500/40 transition-all duration-200 shadow-[0_0_20px_rgba(6,182,212,0.05)] hover:shadow-[0_0_30px_rgba(6,182,212,0.1)]">
                        <div className="p-3 bg-cyan-500/10 rounded-full mb-2 group-hover:scale-110 transition-transform">
                            <Check className="w-6 h-6 text-cyan-400" />
                        </div>
                        <span className="font-semibold text-cyan-400">Approve [A]</span>
                    </button>
                </div>
            </div>

            {/* RIGHT: CONTEXT (AI Analysis placeholder or Similar signals) */}
            <div className="hidden lg:block p-8 rounded-3xl bg-black/20 border border-white/5">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-6 border-b border-white/5 pb-2">Analysis Net</h3>

                <div className="space-y-6">
                    <div>
                        <label className="text-xs text-gray-500 block mb-1">AI Confidence</label>
                        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-cyan-500" style={{ width: `${currentSignal.confidence_score || 50}%` }} />
                        </div>
                        <div className="flex justify-between text-xs mt-1 text-gray-400">
                            <span>Low</span>
                            <span>{currentSignal.confidence_score || 50}%</span>
                            <span>High</span>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs text-gray-500 block mb-2">Key Topics</label>
                        <div className="flex flex-wrap gap-2">
                            {currentSignal.ai_tags?.map((tag: any, i: any) => (
                                <span key={i} className="text-sm text-gray-300">#{tag}</span>
                            ))}
                            {(!currentSignal.ai_tags || currentSignal.ai_tags.length === 0) && <span className="text-sm text-gray-600">No tags generated</span>}
                        </div>
                    </div>

                    <div className="bg-blue-500/5 border border-blue-500/10 p-4 rounded-xl">
                        <label className="text-xs text-blue-400 block mb-1">Triage Report</label>
                        <p className="text-sm text-gray-300 leading-relaxed italic">
                            "{currentSignal.metadata?.triage_reason || "Pending analysis..."}"
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
