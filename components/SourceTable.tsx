"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    ChevronDown, ChevronUp, AlertCircle, Check, X, Edit, Trash2, Loader2
} from 'lucide-react'
import { updateSourceAction, toggleSourceAction, deleteSourceAction } from '@/app/actions'
import { toast } from 'sonner'

interface SourceTableProps {
    sources: any[]
}

export default function SourceTable({ sources }: SourceTableProps) {
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const router = useRouter();

    const toggleExpand = (id: string) => {
        setExpandedId(prev => prev === id ? null : id);
    };

    return (
        <div className="bg-white/[0.02] border border-white/10 rounded-xl overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 p-4 bg-white/5 border-b border-white/10 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <div className="col-span-4">Name</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-2">Priority</div>
                <div className="col-span-2">Max Articles</div>
                <div className="col-span-2">Last Ingested</div>
            </div>

            {/* Table Rows */}
            <div className="divide-y divide-white/5">
                {sources.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        No sources configured. Add RSS feeds in Settings.
                    </div>
                ) : (
                    sources.map((source) => (
                        <SourceRow
                            key={source.id}
                            source={source}
                            isExpanded={expandedId === source.id}
                            onToggle={() => toggleExpand(source.id)}
                            onRefresh={() => router.refresh()}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

function SourceRow({ source, isExpanded, onToggle, onRefresh }: any) {
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [toggling, setToggling] = useState(false);

    // Form state
    const [maxArticles, setMaxArticles] = useState(source.max_articles_per_ingest || 10);
    const [priority, setPriority] = useState(source.priority || 99);
    const [active, setActive] = useState(source.active);

    const isHealthy = source.active && !source.auto_disabled && source.consecutive_failures === 0;
    const hasWarning = source.consecutive_failures > 0 && source.consecutive_failures < 5;
    const isDisabled = source.auto_disabled || !source.active;

    const statusIcon = isHealthy ? '🟢' : hasWarning ? '🟡' : '🔴';
    const statusText = isHealthy ? 'Active' : hasWarning ? 'Warning' : 'Disabled';

    const handleSave = async () => {
        setSaving(true);
        try {
            const result: any = await updateSourceAction(source.id, {
                max_articles_per_ingest: maxArticles,
                priority: priority,
                active: active
            });

            if (result.success) {
                toast.success("Source updated!");
                setEditing(false);
                onRefresh();
            } else {
                toast.error("Update failed: " + result.error);
            }
        } catch (e) {
            toast.error("Error updating source");
        } finally {
            setSaving(false);
        }
    };

    const handleToggle = async () => {
        setToggling(true);
        try {
            await toggleSourceAction(source.id, !source.active);
            toast.success(source.active ? "Source disabled" : "Source enabled");
            onRefresh();
        } catch (e) {
            toast.error("Failed to toggle source");
        } finally {
            setToggling(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm(`Delete source "${source.name}"?`)) return;
        try {
            await deleteSourceAction(source.id);
            toast.success("Source deleted");
            onRefresh();
        } catch (e) {
            toast.error("Failed to delete source");
        }
    };

    return (
        <div className="hover:bg-white/[0.02] transition-colors">
            {/* Main Row */}
            <div
                onClick={onToggle}
                className="grid grid-cols-12 gap-4 p-4 cursor-pointer items-center"
            >
                <div className="col-span-4 flex items-center gap-2">
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                    <span className="font-medium truncate">{source.name}</span>
                </div>
                <div className="col-span-2">
                    <span className={`text-sm ${isHealthy ? 'text-green-400' : hasWarning ? 'text-yellow-400' : 'text-red-400'}`}>
                        {statusIcon} {statusText}
                    </span>
                </div>
                <div className="col-span-2 text-sm text-gray-400">
                    {source.priority || 99}
                </div>
                <div className="col-span-2 text-sm text-gray-400">
                    {source.max_articles_per_ingest || 10}
                </div>
                <div className="col-span-2 text-sm text-gray-500">
                    {source.last_ingested_at ? new Date(source.last_ingested_at).toLocaleDateString() : 'Never'}
                </div>
            </div>

            {/* Expanded Details */}
            {isExpanded && (
                <div className="px-4 pb-4 border-t border-white/5 bg-black/20">
                    <div className="py-4 space-y-4">
                        {/* URL */}
                        <div>
                            <label className="text-xs text-gray-400 mb-1 block">RSS URL</label>
                            <p className="text-sm text-gray-300 font-mono truncate bg-white/5 px-3 py-2 rounded">
                                {source.url}
                            </p>
                        </div>

                        {/* Health Info */}
                        {source.consecutive_failures > 0 && (
                            <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-lg">
                                <div className="flex items-center gap-2 text-yellow-400 text-sm">
                                    <AlertCircle className="w-4 h-4" />
                                    <span className="font-semibold">{source.consecutive_failures} consecutive failures</span>
                                </div>
                            </div>
                        )}

                        {/* Edit Form */}
                        {editing ? (
                            <div className="grid grid-cols-3 gap-4 pt-2">
                                <div>
                                    <label className="text-xs text-gray-400 mb-1 block">Max Articles</label>
                                    <input
                                        type="number"
                                        value={maxArticles}
                                        onChange={(e) => setMaxArticles(parseInt(e.target.value) || 10)}
                                        min="1"
                                        max="50"
                                        className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-500/50"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400 mb-1 block">Priority (1=highest)</label>
                                    <input
                                        type="number"
                                        value={priority}
                                        onChange={(e) => setPriority(parseInt(e.target.value) || 99)}
                                        min="1"
                                        max="999"
                                        className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-500/50"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400 mb-1 block">Status</label>
                                    <select
                                        value={active ? 'active' : 'disabled'}
                                        onChange={(e) => setActive(e.target.value === 'active')}
                                        className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-500/50"
                                    >
                                        <option value="active">Active</option>
                                        <option value="disabled">Disabled</option>
                                    </select>
                                </div>
                            </div>
                        ) : null}

                        {/* Actions */}
                        <div className="flex items-center gap-3 pt-2">
                            {editing ? (
                                <>
                                    <button
                                        onClick={handleSave}
                                        disabled={saving}
                                        className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-400 text-black font-bold rounded-lg text-sm transition-colors disabled:opacity-50"
                                    >
                                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                        Save
                                    </button>
                                    <button
                                        onClick={() => setEditing(false)}
                                        className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                        Cancel
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setEditing(true); }}
                                        className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 rounded-lg text-sm transition-colors border border-cyan-500/20"
                                    >
                                        <Edit className="w-4 h-4" />
                                        Edit
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleToggle(); }}
                                        disabled={toggling}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors border disabled:opacity-50 ${source.active
                                            ? 'bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border-yellow-500/20'
                                            : 'bg-green-500/10 hover:bg-green-500/20 text-green-400 border-green-500/20'
                                            }`}
                                    >
                                        {source.active ? 'Disable' : 'Enable'}
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                                        className="ml-auto flex items-center gap-2 px-3 py-2 text-gray-500 hover:text-red-400 text-sm transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        Delete
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
