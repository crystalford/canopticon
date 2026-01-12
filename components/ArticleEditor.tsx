"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    Save, CheckCircle, Eye, Trash2, X, ArrowLeft, Share2, Video,
    AlertTriangle, Scale, Target, Loader2, ExternalLink
} from 'lucide-react'
import { updateArticleAction, updateSignalStatusAction, generateSocialPostAction, generateVideoMaterialsAction } from '@/app/actions'
import { toast } from 'sonner'
import Link from 'next/link'

interface ArticleEditorProps {
    signal: any
}

export default function ArticleEditor({ signal }: ArticleEditorProps) {
    const router = useRouter();
    const [saving, setSaving] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [socialGenerating, setSocialGenerating] = useState(false);
    const [videoGenerating, setVideoGenerating] = useState(false);

    // Form state
    const [headline, setHeadline] = useState(signal.headline || '');
    const [summary, setSummary] = useState(signal.ai_summary || signal.summary || '');
    const [content, setContent] = useState(signal.raw_content || '');
    const [socialPost, setSocialPost] = useState(signal.metadata?.social_post || '');
    const [videoScript, setVideoScript] = useState(signal.ai_script || '');

    const isDraft = signal.status === 'draft';
    const isPublished = signal.status === 'published';

    const handleSave = async () => {
        setSaving(true);
        try {
            const result: any = await updateArticleAction(signal.id, {
                headline,
                ai_summary: summary,
                raw_content: content,
                metadata: {
                    ...signal.metadata,
                    social_post: socialPost
                },
                ai_script: videoScript
            });

            if (result.success) {
                toast.success("Saved!");
                router.refresh();
            } else {
                toast.error("Save failed: " + result.error);
            }
        } catch (e: any) {
            toast.error("Error: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    const handlePublish = async () => {
        setPublishing(true);
        try {
            // Save first
            await updateArticleAction(signal.id, {
                headline,
                ai_summary: summary,
                raw_content: content,
                metadata: { ...signal.metadata, social_post: socialPost },
                ai_script: videoScript
            });

            // Then publish
            await updateSignalStatusAction(signal.hash || signal.id, 'published');
            toast.success("Published!");
            router.push('/admin/content');
        } catch (e) {
            toast.error("Publishing failed");
        } finally {
            setPublishing(false);
        }
    };

    const handleUnpublish = async () => {
        try {
            await updateSignalStatusAction(signal.hash || signal.id, 'draft');
            toast.success("Moved to drafts");
            router.refresh();
        } catch (e) {
            toast.error("Failed to unpublish");
        }
    };

    const handleDelete = async () => {
        if (!confirm("Are you sure you want to delete this article?")) return;
        try {
            await updateSignalStatusAction(signal.hash || signal.id, 'deleted');
            toast.success("Deleted");
            router.push('/admin/content');
        } catch (e) {
            toast.error("Failed to delete");
        }
    };

    const handlePreview = () => {
        window.open(`/articles/${signal.hash || signal.id}?preview=true`, '_blank');
    };

    const handleGenerateSocial = async () => {
        setSocialGenerating(true);
        try {
            const result: any = await generateSocialPostAction(signal.id, headline, summary);
            if (result.success) {
                setSocialPost(result.post);
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
                setVideoScript(result.script || '');
                toast.success("Video materials generated!");
                router.refresh();
            } else {
                toast.error("Failed: " + result.error);
            }
        } catch (e) {
            toast.error("Error generating video");
        } finally {
            setVideoGenerating(false);
        }
    };

    const handlePostToX = () => {
        const text = encodeURIComponent(socialPost);
        const url = encodeURIComponent(`https://canopticon.com/articles/${signal.hash || signal.id}`);
        window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
    };

    return (
        <div className="min-h-screen flex flex-col">
            {/* Top Bar */}
            <div className="sticky top-0 z-50 bg-black/95 backdrop-blur border-b border-white/10">
                <div className="max-w-[1800px] mx-auto px-4 py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Link href="/admin/content" className="text-gray-400 hover:text-white transition-colors">
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <h1 className="text-sm font-semibold">Edit Article</h1>
                            <p className="text-xs text-gray-500">
                                {isDraft ? '🟡 Draft' : '🟢 Published'} • {signal.sources?.name || signal.source}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Save
                        </button>
                        <button
                            onClick={handlePreview}
                            className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 rounded-lg text-sm transition-colors border border-cyan-500/20"
                        >
                            <Eye className="w-4 h-4" />
                            Preview
                        </button>
                        {isDraft && (
                            <button
                                onClick={handlePublish}
                                disabled={publishing}
                                className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-400 text-black font-bold rounded-lg text-sm transition-colors disabled:opacity-50"
                            >
                                {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                Publish
                            </button>
                        )}
                        {isPublished && (
                            <button
                                onClick={handleUnpublish}
                                className="flex items-center gap-2 px-4 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 rounded-lg text-sm transition-colors border border-yellow-500/20"
                            >
                                <X className="w-4 h-4" />
                                Unpublish
                            </button>
                        )}
                        <button
                            onClick={handleDelete}
                            className="flex items-center gap-2 px-3 py-2 text-gray-500 hover:text-red-400 text-sm transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content - Split Panel */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-[1800px] mx-auto w-full p-6">
                {/* Left Panel - Content Editing */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Headline */}
                    <div>
                        <label className="text-xs text-gray-400 mb-2 block">Headline</label>
                        <input
                            type="text"
                            value={headline}
                            onChange={(e) => setHeadline(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-xl font-bold focus:outline-none focus:border-cyan-500/50"
                            placeholder="Article headline..."
                        />
                    </div>

                    {/* Summary */}
                    <div>
                        <label className="text-xs text-gray-400 mb-2 block">Summary</label>
                        <textarea
                            value={summary}
                            onChange={(e) => setSummary(e.target.value)}
                            rows={4}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-gray-300 focus:outline-none focus:border-cyan-500/50 resize-none"
                            placeholder="Brief summary..."
                        />
                    </div>

                    {/* Full Content */}
                    <div>
                        <label className="text-xs text-gray-400 mb-2 block">Full Content</label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            rows={20}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-gray-300 leading-relaxed focus:outline-none focus:border-cyan-500/50 font-mono"
                            placeholder="Full article content..."
                        />
                    </div>
                </div>

                {/* Right Panel - AI Materials & Insights */}
                <div className="space-y-6">
                    {/* Social Post */}
                    <div className="bg-white/[0.02] border border-white/10 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                            <label className="text-xs text-gray-400 flex items-center gap-2">
                                <Share2 className="w-4 h-4" />
                                Social Post
                            </label>
                            <button
                                onClick={handleGenerateSocial}
                                disabled={socialGenerating}
                                className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors disabled:opacity-50"
                            >
                                {socialGenerating ? 'Generating...' : 'Generate'}
                            </button>
                        </div>
                        <textarea
                            value={socialPost}
                            onChange={(e) => setSocialPost(e.target.value)}
                            rows={4}
                            className="w-full bg-black/20 border border-white/5 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-cyan-500/50 resize-none"
                            placeholder="Generate a social media post..."
                        />
                        {socialPost && (
                            <button
                                onClick={handlePostToX}
                                className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg text-xs transition-colors border border-blue-500/20"
                            >
                                <ExternalLink className="w-3 h-3" />
                                Post to X
                            </button>
                        )}
                    </div>

                    {/* Video Script */}
                    <div className="bg-white/[0.02] border border-white/10 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                            <label className="text-xs text-gray-400 flex items-center gap-2">
                                <Video className="w-4 h-4" />
                                Video Script
                            </label>
                            <button
                                onClick={handleGenerateVideo}
                                disabled={videoGenerating}
                                className="text-xs text-purple-400 hover:text-purple-300 transition-colors disabled:opacity-50"
                            >
                                {videoGenerating ? 'Generating...' : 'Generate'}
                            </button>
                        </div>
                        <textarea
                            value={videoScript}
                            onChange={(e) => setVideoScript(e.target.value)}
                            rows={8}
                            className="w-full bg-black/20 border border-white/5 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-purple-500/50 resize-none font-mono"
                            placeholder="Generate video script..."
                        />
                    </div>

                    {/* AI Insights */}
                    {(signal.metadata?.fallacies?.length > 0 || signal.metadata?.bias || signal.metadata?.rhetoric) && (
                        <div className="bg-white/[0.02] border border-white/10 rounded-xl p-4 space-y-4">
                            <h3 className="text-xs text-gray-400 font-semibold">AI Insights</h3>

                            {/* Fallacies */}
                            {signal.metadata?.fallacies?.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-orange-400 text-xs">
                                        <AlertTriangle className="w-3 h-3" />
                                        <span className="font-semibold">Fallacies Detected</span>
                                    </div>
                                    {signal.metadata.fallacies.map((fallacy: any, i: number) => (
                                        <div key={i} className="bg-orange-500/5 border border-orange-500/10 p-2 rounded text-xs">
                                            <span className="text-orange-300 font-bold block">{fallacy.name}</span>
                                            <span className="text-gray-400">{fallacy.explanation}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Bias */}
                            {signal.metadata?.bias && (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-gray-400 text-xs">
                                        <Scale className="w-3 h-3" />
                                        <span className="font-semibold">Political Bias</span>
                                    </div>
                                    <div className="bg-white/5 p-2 rounded text-xs">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`font-bold ${signal.metadata.bias.orientation === 'Left' ? 'text-blue-400' :
                                                    signal.metadata.bias.orientation === 'Right' ? 'text-red-400' :
                                                        'text-gray-400'
                                                }`}>
                                                {signal.metadata.bias.orientation}
                                            </span>
                                            <span className="text-gray-500">({Math.round(signal.metadata.bias.intensity * 100)}%)</span>
                                        </div>
                                        <p className="text-gray-400 text-[10px] leading-tight">{signal.metadata.bias.explanation}</p>
                                    </div>
                                </div>
                            )}

                            {/* Rhetoric */}
                            {signal.metadata?.rhetoric?.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-gray-400 text-xs">
                                        <Target className="w-3 h-3" />
                                        <span className="font-semibold">Rhetoric</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {signal.metadata.rhetoric.map((r: string, i: number) => (
                                            <span key={i} className="px-2 py-1 bg-white/10 rounded text-[10px] text-gray-300">
                                                {r}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
