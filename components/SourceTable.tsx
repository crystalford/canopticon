"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    Power, Trash2, ArrowUp, ArrowDown, ExternalLink, RefreshCw, Rss
} from 'lucide-react'
import { updateSourceAction, toggleSourceAction, deleteSourceAction } from '@/app/actions'
import { toast } from 'sonner'
import LiquidChromeButton from './LiquidChromeButton'

interface SourceTableProps {
    sources: any[]
}

export default function SourceTable({ sources }: SourceTableProps) {
    const router = useRouter();

    const handleRefresh = () => {
        router.refresh();
    };

    if (sources.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500 bg-white/[0.02] border border-white/10 rounded-xl">
                <Rss className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-lg font-medium text-white">No Sources Configured</p>
                <p className="text-sm">Add RSS feeds to start ingesting content.</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {sources.map((source) => (
                <SourceCard
                    key={source.id}
                    source={source}
                    onRefresh={handleRefresh}
                />
            ))}
        </div>
    );
}

function SourceCard({ source, onRefresh }: { source: any, onRefresh: () => void }) {
    const [loading, setLoading] = useState(false);

    // Local state for quick edits
    const [priority, setPriority] = useState(source.priority || 5);
    const [maxArticles, setMaxArticles] = useState(source.max_articles_per_ingest || 10);

    const handleToggle = async (e: React.MouseEvent) => {
        e.stopPropagation();
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
        e.stopPropagation();
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

    const StatusIcon = source.active ? Power : Power;

    return (
        <div className={`
            group relative overflow-hidden rounded-xl border transition-all duration-300
            ${source.active
                ? 'bg-white/[0.03] border-white/10 hover:border-white/20'
                : 'bg-red-900/5 border-red-500/10 opacity-75 grayscale-[0.5]'}
        `}>
            {/* Background Glow */}
            {source.active && (
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            )}

            <div className="relative p-5 flex flex-col md:flex-row items-start md:items-center gap-6">

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
                        <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-gray-500 hover:text-cyan-400 hover:underline flex items-center gap-1 font-mono truncate max-w-[300px]"
                        >
                            {source.url}
                            <ExternalLink className="w-3 h-3 text-gray-600 group-hover:text-cyan-500" />
                        </a>
                    </div>
                </div>

                {/* 2. Controls Area (Priority, Max) */}
                <div className="flex items-center gap-6 border-l border-white/5 pl-6 md:border-none md:pl-0">

                    {/* Priority Control */}
                    <div className="flex flex-col items-center gap-1">
                        <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Priority</span>
                        <div className="flex items-center gap-2 bg-black/20 rounded-lg p-1 border border-white/5">
                            <button
                                onClick={() => handleUpdate({ priority: Math.max(1, (source.priority || 5) - 1) })}
                                className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                                disabled={loading}
                            >
                                <ArrowUp className="w-3 h-3" />
                            </button>
                            <span className="text-sm font-mono font-medium text-cyan-400 w-4 text-center">
                                {source.priority || 5}
                            </span>
                            <button
                                onClick={() => handleUpdate({ priority: (source.priority || 5) + 1 })}
                                className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                                disabled={loading}
                            >
                                <ArrowDown className="w-3 h-3" />
                            </button>
                        </div>
                    </div>

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
    );
}
