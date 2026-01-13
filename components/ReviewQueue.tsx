"use client"

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Signal } from '@/types'
import {
    Check, X, SkipForward, ExternalLink, RefreshCw, Flag, Video, Pencil,
    Filter, ChevronDown, CheckSquare, Square, Clock, Zap, AlertCircle
} from 'lucide-react'
import { updateSignalStatusAction, flagSignalAction } from '@/app/actions'
import { useRouter } from 'next/navigation'
import EditBeforePublishModal from './EditBeforePublishModal'
import { toast } from 'sonner'

interface ReviewQueueProps {
    initialSignals: any[]
}

type SortOption = 'confidence' | 'time' | 'source';

export default function ReviewQueue({ initialSignals }: ReviewQueueProps) {
    const [queue, setQueue] = useState<any[]>(initialSignals);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [processing, setProcessing] = useState(false);
    const [sortBy, setSortBy] = useState<SortOption>('confidence');
    const [filterSource, setFilterSource] = useState<string>('all');
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const router = useRouter();

    // Get unique sources for filter dropdown
    const sources = useMemo(() => {
        const sourceNames = new Set<string>();
        initialSignals.forEach(s => {
            const name = s.sources?.name || s.source || 'Unknown';
            sourceNames.add(name);
        });
        return Array.from(sourceNames).sort();
    }, [initialSignals]);

    // Sorted and filtered queue
    const sortedQueue = useMemo(() => {
        let result = [...queue];

        // Filter by source
        if (filterSource !== 'all') {
            result = result.filter(s => (s.sources?.name || s.source) === filterSource);
        }

        // Sort
        if (sortBy === 'confidence') {
            result.sort((a, b) => (b.confidence_score || 0) - (a.confidence_score || 0));
        } else if (sortBy === 'time') {
            result.sort((a, b) => new Date(b.published_at || b.created_at).getTime() - new Date(a.published_at || a.created_at).getTime());
        } else if (sortBy === 'source') {
            result.sort((a, b) => (a.sources?.name || a.source || '').localeCompare(b.sources?.name || b.source || ''));
        }

        return result;
    }, [queue, sortBy, filterSource]);

    const currentSignal = sortedQueue[selectedIndex];

    // Handle single action
    const handleAction = useCallback(async (action: 'approve' | 'reject' | 'skip' | 'flag', signalId?: string) => {
        const targetId = signalId || (currentSignal?.hash || currentSignal?.id);
        if (!targetId || processing) return;
        setProcessing(true);

        try {
            if (action === 'approve') {
                await updateSignalStatusAction(targetId, 'draft');
                toast.success("Approved as draft.");
            } else if (action === 'reject') {
                await updateSignalStatusAction(targetId, 'deleted');
                toast.info("Signal rejected.");
            }

            // Remove from queue
            setQueue(prev => prev.filter(s => (s.hash || s.id) !== targetId));
            setSelectedIds(prev => {
                const next = new Set(prev);
                next.delete(targetId);
                return next;
            });

            // Adjust selection if needed
            if (selectedIndex >= sortedQueue.length - 1) {
                setSelectedIndex(Math.max(0, sortedQueue.length - 2));
            }
        } catch (e) {
            console.error("Action failed", e);
            toast.error("Failed to update status");
        }

        setProcessing(false);
    }, [currentSignal, processing, selectedIndex, sortedQueue.length]);

    // Handle bulk action
    const handleBulkAction = useCallback(async (action: 'approve' | 'reject' | 'flag') => {
        if (selectedIds.size === 0 || processing) return;

        const confirmed = confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} ${selectedIds.size} signals?`);
        if (!confirmed) return;

        setProcessing(true);

        for (const id of selectedIds) {
            try {
                if (action === 'approve') {
                    await updateSignalStatusAction(id, 'published');
                } else if (action === 'reject') {
                    await updateSignalStatusAction(id, 'deleted');
                } else if (action === 'flag') {
                    await flagSignalAction(id);
                }
            } catch (e) {
                console.error(`Failed for ${id}`, e);
            }
        }

        // Remove all processed signals
        setQueue(prev => prev.filter(s => !selectedIds.has(s.hash || s.id)));
        setSelectedIds(new Set());
        setSelectedIndex(0);
        setProcessing(false);
    }, [selectedIds, processing]);

    // Toggle selection
    const toggleSelection = (signalId: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(signalId)) {
                next.delete(signalId);
            } else {
                next.add(signalId);
            }
            return next;
        });
    };

    const selectAll = () => {
        setSelectedIds(new Set(sortedQueue.map(s => s.hash || s.id)));
    };

    const deselectAll = () => {
        setSelectedIds(new Set());
    };

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (processing) return;
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            const key = e.key.toLowerCase();

            if (key === 'j' || e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => Math.min(prev + 1, sortedQueue.length - 1));
            } else if (key === 'k' || e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => Math.max(prev - 1, 0));
            } else if (key === ' ') {
                e.preventDefault();
                if (currentSignal) toggleSelection(currentSignal.hash || currentSignal.id);
            } else if (key === 'a') {
                handleAction('approve');
            } else if (key === 'r' || key === 'x') {
                handleAction('reject');
            } else if (key === 's') {
                handleAction('skip');
            } else if (key === 'f') {
                handleAction('flag');
            } else if (key === 'e') {
                setIsEditModalOpen(true);
            } else if (key === 'escape') {
                if (isEditModalOpen) {
                    setIsEditModalOpen(false);
                } else {
                    deselectAll();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleAction, processing, currentSignal, sortedQueue.length, isEditModalOpen]);

    if (queue.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-4">
                <div className="p-4 bg-white/5 rounded-full">
                    <Check className="w-12 h-12 text-green-500" />
                </div>
                <h2 className="text-xl font-medium text-white">All Caught Up</h2>
                <p>No pending signals to review.</p>
                <button onClick={() => router.refresh()} className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm text-gray-300 transition-colors">
                    <RefreshCw className="w-4 h-4" /> Refresh
                </button>
            </div>
        )
    }

    return (
        <div className="h-full flex flex-col gap-4">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white/[0.02] rounded-xl border border-white/10">
                {/* Selection Controls */}
                <div className="flex items-center gap-3">
                    <button onClick={selectAll} className="text-xs text-gray-400 hover:text-white transition-colors">
                        Select All
                    </button>
                    <span className="text-gray-600">|</span>
                    <button onClick={deselectAll} className="text-xs text-gray-400 hover:text-white transition-colors">
                        Deselect All
                    </button>
                    {selectedIds.size > 0 && (
                        <span className="text-xs text-cyan-400 font-mono bg-cyan-500/10 px-2 py-1 rounded">
                            {selectedIds.size} selected
                        </span>
                    )}
                </div>

                {/* Bulk Actions */}
                {selectedIds.size > 0 && (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => handleBulkAction('approve')}
                            disabled={processing}
                            className="flex items-center gap-1 px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                        >
                            <Check className="w-3 h-3" /> Approve as Draft
                        </button>
                        <button
                            onClick={() => handleBulkAction('reject')}
                            disabled={processing}
                            className="flex items-center gap-1 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                        >
                            <X className="w-3 h-3" /> Delete
                        </button>
                    </div>
                )}

                {/* Sort & Filter */}
                <div className="flex items-center gap-3">
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as SortOption)}
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-cyan-500/50"
                    >
                        <option value="confidence">Sort: Confidence</option>
                        <option value="time">Sort: Time</option>
                        <option value="source">Sort: Source</option>
                    </select>

                    <select
                        value={filterSource}
                        onChange={(e) => setFilterSource(e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-cyan-500/50"
                    >
                        <option value="all">All Sources</option>
                        {sources.map(source => (
                            <option key={source} value={source}>{source}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Two-Pane Layout */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-6 min-h-0">
                {/* LEFT PANE: Signal List (40%) */}
                <div className="lg:col-span-2 overflow-y-auto rounded-xl border border-white/10 bg-black/20">
                    <div className="divide-y divide-white/5">
                        {sortedQueue.map((signal, index) => {
                            const signalId = signal.hash || signal.id;
                            const isSelected = index === selectedIndex;
                            const isChecked = selectedIds.has(signalId);
                            const sourceName = signal.sources?.name || signal.source || 'Unknown';

                            return (
                                <div
                                    key={signalId}
                                    onClick={() => setSelectedIndex(index)}
                                    className={`p-4 cursor-pointer transition-all ${isSelected ? 'bg-cyan-500/10 border-l-2 border-l-cyan-500' :
                                        isChecked ? 'bg-yellow-500/5' : 'hover:bg-white/5'
                                        }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); toggleSelection(signalId); }}
                                            className="mt-1 text-gray-500 hover:text-white"
                                        >
                                            {isChecked ? <CheckSquare className="w-4 h-4 text-cyan-400" /> : <Square className="w-4 h-4" />}
                                        </button>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${(signal.confidence_score || 0) >= 80 ? 'bg-green-500/20 text-green-400' :
                                                    (signal.confidence_score || 0) >= 60 ? 'bg-cyan-500/20 text-cyan-400' :
                                                        'bg-yellow-500/20 text-yellow-400'
                                                    }`}>
                                                    {signal.confidence_score || '??'}
                                                </span>
                                                {signal.signal_type && (
                                                    <span className="text-xs text-gray-500">[{signal.signal_type}]</span>
                                                )}
                                            </div>
                                            <h3 className="text-sm font-medium line-clamp-2 mb-1">{signal.headline}</h3>
                                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                                <span>{sourceName}</span>
                                                <span>•</span>
                                                <span>{new Date(signal.published_at || signal.created_at).toLocaleTimeString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* RIGHT PANE: Preview & Actions (60%) */}
                <div className="lg:col-span-3 flex flex-col min-h-0">
                    {currentSignal ? (
                        <>
                            {/* Preview Card */}
                            <div className="flex-1 overflow-y-auto p-6 rounded-xl bg-white/[0.02] border border-white/10 mb-4">
                                {/* Header */}
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <span className={`text-lg font-mono px-2 py-1 rounded ${(currentSignal.confidence_score || 0) >= 80 ? 'bg-green-500/20 text-green-400' :
                                            (currentSignal.confidence_score || 0) >= 60 ? 'bg-cyan-500/20 text-cyan-400' :
                                                'bg-yellow-500/20 text-yellow-400'
                                            }`}>
                                            {currentSignal.confidence_score || '??'}%
                                        </span>
                                        <span className="text-sm text-cyan-400 font-mono uppercase">
                                            {currentSignal.sources?.name || currentSignal.source}
                                        </span>
                                    </div>
                                    <span className="text-xs text-gray-500">
                                        {new Date(currentSignal.published_at || currentSignal.created_at).toLocaleString()}
                                    </span>
                                </div>

                                {/* Content */}
                                <h1 className="text-2xl font-bold mb-4">{currentSignal.headline}</h1>
                                <p className="text-gray-300 leading-relaxed mb-6">
                                    {currentSignal.summary || currentSignal.ai_summary || "No summary available."}
                                </p>

                                {/* Entities/Tags */}
                                {currentSignal.entities && currentSignal.entities.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mb-6">
                                        {currentSignal.entities.map((e: string, i: number) => (
                                            <span key={i} className="px-2 py-1 bg-white/5 rounded text-xs text-gray-400 border border-white/5">{e}</span>
                                        ))}
                                    </div>
                                )}

                                {/* AI Analysis */}
                                {currentSignal.metadata?.triage_reason && (
                                    <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl mb-6">
                                        <label className="text-xs text-blue-400 block mb-1">AI Analysis</label>
                                        <p className="text-sm text-gray-300 italic">&quot;{currentSignal.metadata.triage_reason}&quot;</p>
                                    </div>
                                )}

                                {/* Source Link */}
                                <a
                                    href={currentSignal.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-sm text-cyan-400 hover:text-cyan-300"
                                >
                                    View Original Source <ExternalLink className="w-3 h-3" />
                                </a>
                            </div>

                            {/* Action Buttons */}
                            <div className="grid grid-cols-5 gap-3">
                                <button
                                    onClick={() => setIsEditModalOpen(true)}
                                    disabled={processing}
                                    className="flex flex-col items-center justify-center p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-all disabled:opacity-50"
                                >
                                    <Pencil className="w-5 h-5 text-blue-400 mb-1" />
                                    <span className="text-sm font-medium text-blue-400">Edit [E]</span>
                                </button>
                                <button
                                    onClick={() => handleAction('reject')}
                                    disabled={processing}
                                    className="flex flex-col items-center justify-center p-4 rounded-xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all disabled:opacity-50"
                                >
                                    <X className="w-5 h-5 text-red-400 mb-1" />
                                    <span className="text-sm font-medium text-red-400">Reject [R]</span>
                                </button>

                                <button
                                    onClick={() => handleAction('skip')}
                                    disabled={processing}
                                    className="flex flex-col items-center justify-center p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all disabled:opacity-50"
                                >
                                    <SkipForward className="w-5 h-5 text-gray-400 mb-1" />
                                    <span className="text-sm font-medium text-gray-400">Skip [S]</span>
                                </button>

                                <button
                                    onClick={() => handleAction('approve')}
                                    disabled={processing}
                                    className="flex flex-col items-center justify-center p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all disabled:opacity-50 col-span-2"
                                >
                                    <Check className="w-5 h-5 text-cyan-400 mb-1" />
                                    <span className="text-sm font-medium text-cyan-400">Approve as Draft [A]</span>
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-gray-500">
                            Select a signal from the list
                        </div>
                    )}
                </div>
            </div>

            {/* Status Bar */}
            <div className="flex items-center justify-between text-xs text-gray-500 px-2">
                <span>Keyboard: [J/K] Navigate • [Space] Toggle Select • [A] Accept (To Studio) • [R] Reject • [S] Skip • [E] Edit • [Esc] Deselect</span>
                <span className="font-mono">{sortedQueue.length} signals</span>
            </div>

            {/* Edit Modal */}
            {isEditModalOpen && currentSignal && (
                <EditBeforePublishModal
                    signal={currentSignal}
                    onClose={() => setIsEditModalOpen(false)}
                    onSave={(action) => {
                        // Remove signal from queue after save
                        const targetId = currentSignal.hash || currentSignal.id;
                        setQueue(prev => prev.filter(s => (s.hash || s.id) !== targetId));
                        setSelectedIds(prev => {
                            const next = new Set(prev);
                            next.delete(targetId);
                            return next;
                        });
                        // Adjust selection if needed
                        if (selectedIndex >= sortedQueue.length - 1) {
                            setSelectedIndex(Math.max(0, sortedQueue.length - 2));
                        }
                    }}
                />
            )}
        </div>
    )
}
