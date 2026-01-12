'use client'

import { useState } from 'react'
import { BrainCircuit, Loader2, Sparkles, AlertCircle } from 'lucide-react'
import { generateDailyBriefingAction } from '@/app/actions'
import { DailyBriefing } from '@/lib/agents/watchman'

export default function WatchmanWidget() {
    const [loading, setLoading] = useState(false)
    const [briefing, setBriefing] = useState<DailyBriefing | null>(null)

    const handleGenerate = async () => {
        setLoading(true)
        try {
            const result = await generateDailyBriefingAction();
            setBriefing(result);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="w-full mb-6 relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-2xl blur-xl group-hover:blur-2xl transition-all" />

            <div className="relative bg-black/40 border border-purple-500/20 rounded-2xl p-6 backdrop-blur-md overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-500/20 rounded-lg border border-purple-500/30">
                            <BrainCircuit className="w-5 h-5 text-purple-300" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white tracking-tight">The Watchman</h2>
                            <p className="text-xs text-purple-300/60 uppercase tracking-widest font-mono">Daily Intelligence Synthesis</p>
                        </div>
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={loading}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold tracking-wide transition-all shadow-[0_0_15px_rgba(168,85,247,0.4)] disabled:opacity-50 disabled:shadow-none flex items-center gap-2"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        {loading ? 'Synthesizing...' : 'Generate Briefing'}
                    </button>
                </div>

                {/* Content */}
                {briefing ? (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="bg-purple-900/10 rounded-xl p-5 border border-purple-500/10">
                            <h3 className="text-xl font-serif text-white mb-2 leading-tight">&quot;{briefing.narrative}&quot;</h3>
                            <div className="flex flex-wrap gap-2 mt-4">
                                {briefing.key_themes.map((theme, i) => (
                                    <span key={i} className="text-[10px] uppercase font-bold tracking-wider text-purple-200 bg-purple-500/10 px-2 py-1 rounded border border-purple-500/10">
                                        {theme}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500 justify-end">
                            <span>Generated via Cortex Memory (RAG + Gemini 1.5)</span>
                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                        </div>
                    </div>
                ) : (
                    <div className="h-24 flex items-center justify-center border-t border-dashed border-white/5 mt-4">
                        <p className="text-sm text-gray-500 italic flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            Reviewing vector memories for strategic patterns...
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
