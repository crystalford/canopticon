"use client"

import { useState } from 'react'
import {
    ChevronDown, ChevronUp, ExternalLink, Edit, Trash2,
    CheckCircle, XCircle, Video, Share2, Loader2
} from 'lucide-react'
import { updateSignalStatusAction, generateVideoMaterialsAction, generateSocialPostAction } from '@/app/actions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface ContentTableProps {
    initialContent: any[]
}

export default function ContentTable({ initialContent }: ContentTableProps) {
    const [content, setContent] = useState(initialContent);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const router = useRouter();

    const handlePublish = async (signal: any) => {
        try {
            await updateSignalStatusAction(signal.hash || signal.id, 'published');
            toast.success("Published!");
            router.refresh();
        } catch (e) {
            toast.error("Failed to publish");
        }
    };

    const handleUnpublish = async (signal: any) => {
        try {
            await updateSignalStatusAction(signal.hash || signal.id, 'draft');
            toast.success("Moved to drafts");
            router.refresh();
        } catch (e) {
            toast.error("Failed to unpublish");
        }
    };

    const handleDelete = async (signal: any) => {
        if (!confirm("Are you sure you want to delete this?")) return;
        try {
            await updateSignalStatusAction(signal.hash || signal.id, 'deleted');
            toast.success("Deleted");
            setContent(prev => prev.filter(s => s.id !== signal.id));
        } catch (e) {
            toast.error("Failed to delete");
        }
    };

    const toggleExpand = (id: string) => {
        setExpandedId(prev => prev === id ? null : id);
    };

    return (
        <div className="bg-white/[0.02] border border-white/10 rounded-xl overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 p-4 bg-white/5 border-b border-white/10 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <div className="col-span-6">Title</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-2">Source</div>
                <div className="col-span-2">Date</div>
            </div>

            {/* Table Rows */}
            <div className="divide-y divide-white/5">
                {content.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        No content found. Approve signals from Review to create drafts.
                    </div>
                ) : (
                    content.map((signal) => (
                        <ContentRow
                            key={signal.id}
                            signal={signal}
                            isExpanded={expandedId === signal.id}
                            onToggle={() => toggleExpand(signal.id)}
                            onPublish={() => handlePublish(signal)}
                            onUnpublish={() => handleUnpublish(signal)}
                            onDelete={() => handleDelete(signal)}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

function ContentRow({ signal, isExpanded, onToggle, onPublish, onUnpublish, onDelete }: any) {
    const [socialGenerating, setSocialGenerating] = useState(false);
    const [videoGenerating, setVideoGenerating] = useState(false);

    const isDraft = signal.status === 'draft';
    const isPublished = signal.status === 'published';

    const handleGenerateSocial = async () => {
        setSocialGenerating(true);
        try {
            const result: any = await generateSocialPostAction(signal.id, signal.headline, signal.ai_summary || signal.summary);
            if (result.success) {
                toast.success("Social post generated!");
            } else {
                toast.error("Failed: " + result.error);
            }
        } catch (e) {
            toast.error("Error generating social post");
        } finally {
            setSocialGenerating(false);
        }
    };

    const handleGenerateVideo = async () => {
        setVideoGenerating(true);
        try {
            const result: any = await generateVideoMaterialsAction(signal.id);
            if (result.success) {
                toast.success("Video materials generated!");
            } else {
                toast.error("Failed: " + result.error);
            }
        } catch (e) {
            toast.error("Error generating video");
        } finally {
            setVideoGenerating(false);
        }
    };

    const handleSocialPost = () => {
        const text = encodeURIComponent(signal.metadata?.social_post);
        const url = encodeURIComponent(`https://canopticon.com/articles/${signal.hash || signal.id}`);
        window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
    };

    return (
        <div className="hover:bg-white/[0.02] transition-colors">
            {/* Main Row */}
            <div
                onClick={onToggle}
                className="grid grid-cols-12 gap-4 p-4 cursor-pointer items-center"
            >
                <div className="col-span-6 flex items-center gap-2">
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                    <span className="font-medium line-clamp-1">{signal.headline}</span>
                </div>
                <div className="col-span-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${isDraft ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'}`}>
                        {isDraft ? '🟡 Draft' : '🟢 Published'}
                    </span>
                </div>
                <div className="col-span-2 text-sm text-gray-400">
                    {signal.sources?.name || signal.source || 'Unknown'}
                </div>
                <div className="col-span-2 text-sm text-gray-500">
                    {new Date(signal.created_at).toLocaleDateString()}
                </div>
            </div>

            {/* Expanded Details */}
            {isExpanded && (
                <div className="px-4 pb-4 border-t border-white/5 bg-black/20">
                    <div className="py-4 space-y-4">
                        {/* Summary */}
                        <p className="text-sm text-gray-300 leading-relaxed">
                            {signal.ai_summary || signal.summary}
                        </p>

                        {/* Generated Assets */}
                        <div className="flex flex-wrap gap-2">
                            {signal.metadata?.social_post && (
                                <span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-1 rounded border border-blue-500/20">
                                    ✓ Social Post
                                </span>
                            )}
                            {signal.ai_script && (
                                <span className="text-xs bg-purple-500/10 text-purple-400 px-2 py-1 rounded border border-purple-500/20">
                                    ✓ Video Script
                                </span>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap items-center gap-3 pt-2">
                            {isDraft && (
                                <>
                                    <a
                                        href={`/admin/content/${signal.id}/edit`}
                                        className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 rounded-lg text-sm transition-colors border border-cyan-500/20"
                                    >
                                        <Edit className="w-4 h-4" />
                                        Edit
                                    </a>
                                    <button
                                        onClick={onPublish}
                                        className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-400 text-black font-bold rounded-lg text-sm transition-colors"
                                    >
                                        <CheckCircle className="w-4 h-4" />
                                        Publish
                                    </button>
                                    <button
                                        onClick={handleGenerateSocial}
                                        disabled={socialGenerating}
                                        className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg text-sm transition-colors border border-blue-500/20 disabled:opacity-50"
                                    >
                                        {socialGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
                                        Generate Social
                                    </button>
                                    <button
                                        onClick={handleGenerateVideo}
                                        disabled={videoGenerating}
                                        className="flex items-center gap-2 px-3 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 rounded-lg text-sm transition-colors border border-purple-500/20 disabled:opacity-50"
                                    >
                                        {videoGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
                                        Generate Video
                                    </button>
                                </>
                            )}

                            {isPublished && (
                                <>
                                    <a
                                        href={`/admin/content/${signal.id}/edit`}
                                        className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 rounded-lg text-sm transition-colors border border-cyan-500/20"
                                    >
                                        <Edit className="w-4 h-4" />
                                        Edit
                                    </a>
                                    <a
                                        href={`/articles/${signal.hash || signal.id}`}
                                        target="_blank"
                                        className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 rounded-lg text-sm transition-colors border border-cyan-500/20"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                        View Live
                                    </a>
                                    <button
                                        onClick={onUnpublish}
                                        className="flex items-center gap-2 px-3 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 rounded-lg text-sm transition-colors border border-yellow-500/20"
                                    >
                                        <XCircle className="w-4 h-4" />
                                        Unpublish
                                    </button>
                                    {signal.metadata?.social_post && (
                                        <button
                                            onClick={handleSocialPost}
                                            className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg text-sm transition-colors border border-blue-500/20"
                                        >
                                            <Share2 className="w-4 h-4" />
                                            Post to X
                                        </button>
                                    )}
                                </>
                            )}

                            <button
                                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                                className="ml-auto flex items-center gap-2 px-3 py-2 text-gray-500 hover:text-red-400 text-sm transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
