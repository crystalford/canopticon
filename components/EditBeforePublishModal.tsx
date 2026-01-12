"use client"

import { useState } from 'react'
import { X, RefreshCw, Loader2, Check, Video } from 'lucide-react'
import { updateSignalStatusAction, flagSignalAction, analyzeSignalAction } from '@/app/actions'

interface EditModalProps {
    signal: any;
    onClose: () => void;
    onSave: (action: 'approve' | 'flag') => void;
}

export default function EditBeforePublishModal({ signal, onClose, onSave }: EditModalProps) {
    const [headline, setHeadline] = useState(signal.headline || '');
    const [summary, setSummary] = useState(signal.ai_summary || signal.summary || '');
    const [regeneratingHeadline, setRegeneratingHeadline] = useState(false);
    const [regeneratingSummary, setRegeneratingSummary] = useState(false);
    const [saving, setSaving] = useState(false);

    const handleRegenerateHeadline = async () => {
        setRegeneratingHeadline(true);
        try {
            const result = await analyzeSignalAction(signal.headline, signal.raw_content || signal.summary || '');
            // Use tags to generate new headline style
            const newHeadline = result.summary?.split('.')[0] || headline;
            setHeadline(newHeadline);
        } catch (e) {
            console.error('Regenerate failed', e);
        }
        setRegeneratingHeadline(false);
    };

    const handleRegenerateSummary = async () => {
        setRegeneratingSummary(true);
        try {
            const result = await analyzeSignalAction(headline, signal.raw_content || signal.summary || '');
            if (result.summary) {
                setSummary(result.summary);
            }
        } catch (e) {
            console.error('Regenerate failed', e);
        }
        setRegeneratingSummary(false);
    };

    const handleSaveAndApprove = async () => {
        setSaving(true);
        // In a full implementation, we'd update the signal with the new headline/summary
        // For now, just approve
        await updateSignalStatusAction(signal.hash || signal.id, 'published');
        setSaving(false);
        onSave('approve');
        onClose();
    };

    const handleSaveAndFlag = async () => {
        setSaving(true);
        await flagSignalAction(signal.hash || signal.id);
        setSaving(false);
        onSave('flag');
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10">
                    <h2 className="text-xl font-bold">Edit Signal Before Publishing</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Headline */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm text-gray-400 font-medium">Headline</label>
                            <button
                                onClick={handleRegenerateHeadline}
                                disabled={regeneratingHeadline}
                                className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 disabled:opacity-50"
                            >
                                {regeneratingHeadline ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                                Regenerate
                            </button>
                        </div>
                        <input
                            type="text"
                            value={headline}
                            onChange={(e) => setHeadline(e.target.value)}
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500/50"
                        />
                    </div>

                    {/* Summary */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm text-gray-400 font-medium">Summary (3 paragraphs)</label>
                            <button
                                onClick={handleRegenerateSummary}
                                disabled={regeneratingSummary}
                                className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 disabled:opacity-50"
                            >
                                {regeneratingSummary ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                                Regenerate
                            </button>
                        </div>
                        <textarea
                            value={summary}
                            onChange={(e) => setSummary(e.target.value)}
                            rows={8}
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500/50 resize-none"
                        />
                    </div>

                    {/* Source Info */}
                    <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                        <div className="flex items-center gap-4 text-sm text-gray-400">
                            <span><strong className="text-gray-300">Source:</strong> {signal.sources?.name || signal.source}</span>
                            <span><strong className="text-gray-300">Confidence:</strong> {signal.confidence_score || '??'}%</span>
                            <span><strong className="text-gray-300">Type:</strong> {signal.signal_type || 'novelty'}</span>
                        </div>
                    </div>

                    {/* Generated Content Preview (collapsed by default) */}
                    <details className="group">
                        <summary className="cursor-pointer text-sm text-gray-400 hover:text-white transition-colors">
                            ▶ View Generated Content (Platform-specific)
                        </summary>
                        <div className="mt-4 pl-4 border-l border-white/10 space-y-4">
                            <p className="text-sm text-gray-500 italic">
                                Platform-specific content (X Thread, YouTube Script, TikTok Caption) will be generated after publishing.
                            </p>
                        </div>
                    </details>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-white/10">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSaveAndFlag}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                        <Video className="w-4 h-4" />
                        Save & Flag for Video
                    </button>
                    <button
                        onClick={handleSaveAndApprove}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        Save & Approve
                    </button>
                </div>
            </div>
        </div>
    );
}
