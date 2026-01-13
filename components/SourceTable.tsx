"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
    Power, Trash2, ExternalLink, Rss, GripVertical
} from 'lucide-react'
import { updateSourceAction, toggleSourceAction, deleteSourceAction } from '@/app/actions'
import { toast } from 'sonner'
import { Reorder, useDragControls } from 'framer-motion'

interface SourceTableProps {
    sources: any[]
}

export default function SourceTable({ sources }: SourceTableProps) {
    const router = useRouter();
    // Local state for drag and drop order
    const [items, setItems] = useState(sources);
    const [isReordering, setIsReordering] = useState(false);

    useEffect(() => {
        setItems(sources);
    }, [sources]);

    const handleReorder = (newOrder: any[]) => {
        setItems(newOrder);
        // We defer the API call to when the drag ends to avoid spamming, 
        // effectively handled by the onReorder callback logic or a specific save.
        // For simpler UX, we'll auto-save logic.
        // Actually, Reorder.Group onChange gets called every frame.
        // We should commit the change onDragEnd or similar, but framer-motion Reorder
        // doesn't have a simple onDragEnd for the group. 
        // We will stick to local state and maybe a "Save Order" or auto-save debounce?
        // Reorder component updates state immediately.

        // Let's rely on individual item 'onDragEnd' or just optimistic UI + debounce?
        // Better: Wait for user to enable reordering mode? No, direct is better.
        // We'll update priorities when drag ends.
    };

    // Function to commit new priorities to DB
    const saveNewOrder = async (reorderedItems: any[]) => {
        setIsReordering(true);
        try {
            // Update all priorities based on new index
            // Priority 1 is top, mapping to index 0
            const updates = reorderedItems.map((item, index) => ({
                id: item.id,
                priority: index + 1
            }));

            // We need a bulk update action, but for now we'll loop parallel requests
            // (Not efficient for 100s, but fine for <50 sources)
            await Promise.all(updates.map(u => updateSourceAction(u.id, { priority: u.priority })));

            toast.success("Order saved");
            router.refresh();
        } catch (e) {
            toast.error("Failed to save order");
        } finally {
            setIsReordering(false);
        }
    };

    if (sources.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500 bg-white/[0.02] border border-white/10 rounded-xl">
                <Rss className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-lg font-medium text-white">No Sources Configured</p>
                <p className="text-sm">Add RSS feeds using the button above.</p>
            </div>
        )
    }

    return (
        <Reorder.Group
            axis="y"
            values={items}
            onReorder={handleReorder}
            className="space-y-4"
        >
            {items.map((source) => (
                <SourceCardDraggable
                    key={source.id}
                    source={source}
                    onRefresh={() => router.refresh()}
                    onDragEnd={() => saveNewOrder(items)} // Naive auto-save on every drop
                />
            ))}
        </Reorder.Group>
    );
}

function SourceCardDraggable({ source, onRefresh, onDragEnd }: { source: any, onRefresh: () => void, onDragEnd: () => void }) {
    const [loading, setLoading] = useState(false);
    const controls = useDragControls();

    // Local state for quick edits
    const [maxArticles, setMaxArticles] = useState(source.max_articles_per_ingest || 10);

    const handleToggle = async (e: React.MouseEvent) => {
        // e.stopPropagation(); // Reorder item might intercept clicks?
        setLoading(true);
        try {
            await toggleSourceAction(source.id, !source.active);
            toast.success(source.active ? "Source disabled" : "Source enabled");
            onRefresh();
        } catch (error) {
            toast.error("Failed to toggle source");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (e: React.MouseEvent) => {
        // e.stopPropagation();
        if (!confirm(`Are you sure you want to delete ${source.name}?`)) return;

        setLoading(true);
        try {
            await deleteSourceAction(source.id);
            toast.success("Source deleted");
            onRefresh();
        } catch (error) {
            toast.error("Failed to delete source");
            setLoading(false);
        }
    };

    const handleUpdate = async (updates: any) => {
        setLoading(true);
        try {
            await updateSourceAction(source.id, updates);
            toast.success("Updated successfully");
            onRefresh();
        } catch (error) {
            toast.error("Update failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Reorder.Item
            value={source}
            dragListener={false}
            dragControls={controls}
            onDragEnd={onDragEnd}
        >
            <div className={`
                group relative overflow-hidden rounded-xl border transition-all duration-300 select-none
                ${source.active
                    ? 'bg-white/[0.03] border-white/10 hover:border-white/20'
                    : 'bg-red-900/5 border-red-500/10 opacity-75 grayscale-[0.5]'}
            `}>
                {/* Background Glow */}
                {source.active && (
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                )}

                <div className="relative p-5 flex flex-col md:flex-row items-start md:items-center gap-6">

                    {/* Drag Handle */}
                    <div
                        onPointerDown={(e) => controls.start(e)}
                        className="cursor-grab active:cursor-grabbing p-2 hover:bg-white/5 rounded text-gray-600 hover:text-white transition-colors self-center md:self-auto"
                    >
                        <GripVertical className="w-5 h-5" />
                    </div>

                    {/* 1. Icon & Core Info */}
                    <div className="flex items-center gap-4 min-w-[250px] flex-1">
                        <div className={`p-3 rounded-xl border ${source.active ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400' : 'bg-white/5 border-white/10 text-gray-500'}`}>
                            <Rss className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h3 className="font-bold text-lg text-white group-hover:text-cyan-400 transition-colors">
                                    {source.name}
                                </h3>
                                {source.category && (
                                    <span className="px-2 py-0.5 rounded text-[10px] uppercase font-mono tracking-wider bg-white/10 text-gray-400 border border-white/5">
                                        {source.category}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
                                <span className="bg-black/30 px-1.5 py-0.5 rounded text-gray-600">P{source.priority}</span>
                                <a
                                    href={source.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:text-cyan-400 hover:underline flex items-center gap-1 truncate max-w-[250px]"
                                >
                                    {source.url}
                                    <ExternalLink className="w-3 h-3 text-gray-600 group-hover:text-cyan-500" />
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* 2. Controls Area (Max) */}
                    <div className="flex items-center gap-6 border-l border-white/5 pl-6 md:border-none md:pl-0">

                        {/* Max Articles Control */}
                        <div className="flex flex-col items-center gap-1">
                            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Max Arts</span>
                            <div className="flex items-center gap-2 bg-black/20 rounded-lg p-1 border border-white/5 px-2">
                                <input
                                    type="number"
                                    value={maxArticles}
                                    onBlur={() => handleUpdate({ max_articles_per_ingest: maxArticles })}
                                    onChange={(e) => setMaxArticles(parseInt(e.target.value) || 0)}
                                    className="w-10 bg-transparent text-center text-sm font-mono text-white focus:outline-none"
                                    min="1"
                                    max="50"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 3. Main Actions (Toggle, Delete) */}
                    <div className="flex items-center gap-3 ml-auto pl-6 border-l border-white/5">
                        {/* Toggle Button */}
                        <button
                            onClick={handleToggle}
                            disabled={loading}
                            className={`
                                relative flex items-center justify-center w-10 h-10 rounded-full border transition-all duration-300
                                ${source.active
                                    ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-400 shadow-[0_0_15px_-5px_var(--cyan-500)]'
                                    : 'bg-white/5 border-white/10 text-gray-600 hover:bg-white/10 hover:text-gray-400'}
                            `}
                            title={source.active ? "Disable Source" : "Enable Source"}
                        >
                            <Power className="w-4 h-4" />
                        </button>

                        {/* Delete Button */}
                        <button
                            onClick={handleDelete}
                            disabled={loading}
                            className="flex items-center justify-center w-10 h-10 rounded-full border border-transparent hover:bg-red-500/10 hover:border-red-500/20 text-gray-600 hover:text-red-500 transition-all duration-300"
                            title="Delete Source"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>

                </div>
            </div>
        </Reorder.Item>
    );
}
