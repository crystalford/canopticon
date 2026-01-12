"use client"

import { useState } from 'react'
import {
    Video, Share2, CheckCircle,
    Loader2, AlertTriangle, Scale, Target
} from 'lucide-react'
import { generateVideoMaterialsAction, updateSignalStatusAction, generateSocialPostAction } from '@/app/actions'
import { toast } from 'sonner'

interface StudioItemProps {
    signal: any;
}

export default function StudioItem({ signal }: StudioItemProps) {
    const [generating, setGenerating] = useState(false);
    const [socialGenerating, setSocialGenerating] = useState(false);
    const [publishing, setPublishing] = useState(false);

    const handleGenerateVideo = async () => {
        setGenerating(true);
        const toastId = toast.loading("Generating video materials...");
        try {
            const result: any = await generateVideoMaterialsAction(signal.id);
            if (result.success) {
                toast.success("Script and assets generated!", { id: toastId });
            } else {
                toast.error("Generation failed: " + result.error, { id: toastId });
            }
        } catch (e: any) {
            toast.error("Error: " + e.message, { id: toastId });
        } finally {
            setGenerating(false);
        }
    };

    const handlePublish = async () => {
        setPublishing(true);
        try {
            await updateSignalStatusAction(signal.hash || signal.id, 'published');
            toast.success("Signal Published Live!");
        } catch (e) {
            toast.error("Publishing failed");
        } finally {
            setPublishing(false);
        }
    };

    const handleSocialAction = async () => {
        // If post exists, open Twitter intent
        if (signal.metadata?.social_post) {
            const text = encodeURIComponent(signal.metadata.social_post);
            const url = encodeURIComponent(`https://canopticon.com/articles/${signal.hash || signal.id}`);
            window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
            return;
        }

        // If not, generate it
        setSocialGenerating(true);
        const toastId = toast.loading("Writing social post...");
        try {
            const result: any = await generateSocialPostAction(signal.id, signal.headline, signal.ai_summary || signal.summary);
            if (result.success) {
                toast.success("Draft created!", { id: toastId });
            } else {
                toast.error("Failed: " + result.error, { id: toastId });
            }
        } catch (e: any) {
            toast.error("Error: " + e.message, { id: toastId });
        } finally {
            setSocialGenerating(false);
        }
    };

    return (
        <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6 flex flex-col gap-4 group hover:border-white/20 transition-all">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <span className="text-xs font-mono text-cyan-400 bg-cyan-500/10 px-2 py-1 rounded">
                        {signal.sources?.name || signal.source}
                    </span>
                    <h3 className="text-xl font-bold mt-2 text-white group-hover:text-cyan-400 transition-colors">
                        {signal.headline}
                    </h3>
                </div>
                <div className="flex flex-col items-end text-xs text-gray-500">
                    <span>{new Date(signal.created_at).toLocaleDateString()}</span>
                    <span className="font-mono">ID: {signal.hash?.slice(0, 6)}</span>
                </div>
            </div>

            {/* AI Summary Section */}
            <div className="text-sm text-gray-400 leading-relaxed bg-black/20 p-4 rounded-lg border border-white/5">
                {signal.ai_summary || signal.summary}
            </div>

            {/* Fallacy Warnings & Deep Intel */}
            {(signal.metadata?.fallacies?.length > 0 || signal.metadata?.bias) && (
                <div className="space-y-4">
                    {/* Fallacies */}
                    {signal.metadata?.fallacies?.length > 0 && (
                        <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-lg space-y-3">
                            <div className="flex items-center gap-2 text-orange-400 text-sm font-semibold">
                                <AlertTriangle className="w-4 h-4" />
                                <span>Potential Mainpulation Detected</span>
                            </div>
                            {signal.metadata.fallacies.map((fallacy: any, i: number) => (
                                <div key={i} className="text-xs bg-black/20 p-2 rounded border border-white/5">
                                    <span className="text-orange-300 font-bold block">{fallacy.name}</span>
                                    <span className="text-gray-400">{fallacy.explanation}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Rhetoric & Bias */}
                    {signal.metadata?.bias && (
                        <div className="grid grid-cols-2 gap-4">
                            {/* Bias Meter */}
                            <div className="bg-white/5 p-3 rounded-lg text-xs border border-white/10">
                                <div className="flex items-center gap-2 text-gray-400 mb-2">
                                    <Scale className="w-3 h-3" />
                                    <span>Political Alignment</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden relative">
                                        <div
                                            className={`absolute h-full rounded-full transition-all duration-500 ${signal.metadata.bias.orientation === 'Left' ? 'bg-blue-500 left-0' :
                                                    signal.metadata.bias.orientation === 'Right' ? 'bg-red-500 right-0' :
                                                        'bg-gray-400 left-1/2 -translate-x-1/2'
                                                }`}
                                            style={{ width: `${Math.max(10, signal.metadata.bias.intensity * 100)}%` }}
                                        />
                                    </div>
                                    <span className={`font-bold ${signal.metadata.bias.orientation === 'Left' ? 'text-blue-400' :
                                            signal.metadata.bias.orientation === 'Right' ? 'text-red-400' :
                                                'text-gray-400'
                                        }`}>
                                        {signal.metadata.bias.orientation}
                                    </span>
                                </div>
                                <div className="mt-2 text-[10px] text-gray-500 line-clamp-2 leading-tight">
                                    {signal.metadata.bias.explanation}
                                </div>
                            </div>

                            {/* Rhetoric Tags */}
                            {signal.metadata?.rhetoric?.length > 0 && (
                                <div className="bg-white/5 p-3 rounded-lg text-xs border border-white/10">
                                    <div className="flex items-center gap-2 text-gray-400 mb-2">
                                        <Target className="w-3 h-3" />
                                        <span>Rhetoric & Tactics</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {signal.metadata.rhetoric.map((t: string, i: number) => (
                                            <span key={i} className="px-1.5 py-0.5 bg-white/10 rounded text-center text-gray-300">
                                                {t}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Social Post Preview */}
            {signal.metadata?.social_post && (
                <div className="bg-blue-500/5 border border-blue-500/10 p-3 rounded-lg">
                    <div className="text-xs text-blue-400 mb-1 flex items-center gap-1">
                        <Share2 className="w-3 h-3" /> Social Draft
                    </div>
                    <p className="text-sm text-gray-300 italic">"{signal.metadata.social_post}"</p>
                </div>
            )}

            {/* Tags */}
            <div className="flex flex-wrap gap-2">
                {signal.ai_tags?.map((tag: string) => (
                    <span key={tag} className="text-xs text-gray-500 border border-white/10 px-2 py-0.5 rounded-full">
                        #{tag}
                    </span>
                ))}
                {!signal.ai_tags && <span className="text-xs text-gray-600 italic">No tags</span>}
            </div>

            <div className="h-px bg-white/10 my-2" />

            {/* Toolbar / Actions */}
            <div className="grid grid-cols-2 gap-4">

                {/* Generation Tools */}
                <div className="flex gap-2">
                    <button
                        onClick={handleGenerateVideo}
                        disabled={generating}
                        className="flex items-center gap-2 px-3 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 rounded-lg text-sm transition-colors border border-purple-500/20 disabled:opacity-50"
                        title="Generate Video Script & Assets"
                    >
                        {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
                        Generate Video
                    </button>
                    <button
                        onClick={handleSocialAction}
                        disabled={socialGenerating}
                        className={`
                            flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors border disabled:opacity-50
                            ${signal.metadata?.social_post
                                ? 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-blue-500/20'
                                : 'bg-gray-800 hover:bg-gray-700 text-gray-400 border-white/10'}
                        `}
                        title={signal.metadata?.social_post ? "Post to X" : "Generate Social Draft"}
                    >
                        {socialGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
                        {signal.metadata?.social_post ? "Post to X" : "Write Post"}
                    </button>
                </div>

                {/* Final Actions */}
                <div className="flex justify-end gap-2">
                    <button
                        onClick={() => updateSignalStatusAction(signal.hash || signal.id, 'archived')}
                        className="px-3 py-2 text-gray-500 hover:text-red-400 text-sm transition-colors"
                    >
                        Archive
                    </button>
                    <button
                        onClick={handlePublish}
                        disabled={publishing}
                        className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-400 text-black font-bold rounded-lg text-sm transition-colors shadow-lg shadow-green-500/20 disabled:opacity-50"
                    >
                        {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                        Publish Live
                    </button>
                </div>
            </div>
        </div>
    )
}
