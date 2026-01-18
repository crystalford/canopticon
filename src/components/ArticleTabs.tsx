'use client'

import { useState } from 'react'
import { FileText, Activity, Play, FileJson } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ArticleTabsProps {
    children: React.ReactNode
    analysisReport?: any
    videoMaterial?: any
}

export function ArticleTabs({ children, analysisReport, videoMaterial }: ArticleTabsProps) {
    const [activeTab, setActiveTab] = useState<'read' | 'analyze' | 'watch'>('read')

    const hasAnalysis = !!analysisReport
    const hasVideo = !!videoMaterial

    return (
        <div className="space-y-8">
            <div className="flex items-center gap-1 border-b border-white/10">
                <button
                    onClick={() => setActiveTab('read')}
                    className={cn(
                        "flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors",
                        activeTab === 'read'
                            ? "border-primary-500 text-primary-400"
                            : "border-transparent text-slate-500 hover:text-slate-300"
                    )}
                >
                    <FileText className="w-4 h-4" />
                    READ
                </button>

                {hasAnalysis && (
                    <button
                        onClick={() => setActiveTab('analyze')}
                        className={cn(
                            "flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors",
                            activeTab === 'analyze'
                                ? "border-primary-500 text-primary-400"
                                : "border-transparent text-slate-500 hover:text-slate-300"
                        )}
                    >
                        <Activity className="w-4 h-4" />
                        ANALYZE
                    </button>
                )}

                {hasVideo && (
                    <button
                        onClick={() => setActiveTab('watch')}
                        className={cn(
                            "flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors",
                            activeTab === 'watch'
                                ? "border-primary-500 text-primary-400"
                                : "border-transparent text-slate-500 hover:text-slate-300"
                        )}
                    >
                        <Play className="w-4 h-4" />
                        WATCH
                    </button>
                )}
            </div>

            <div className="min-h-[400px]">
                {activeTab === 'read' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {children}
                    </div>
                )}

                {activeTab === 'analyze' && analysisReport && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-8">
                        {/* Fallacies */}
                        <div className="p-6 rounded-xl bg-white/5 border border-white/10">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <Activity className="w-5 h-5 text-red-400" />
                                Fallacy Detection
                            </h3>
                            {analysisReport.fallaciesDetected?.length > 0 ? (
                                <ul className="space-y-3">
                                    {analysisReport.fallaciesDetected.map((f: any, i: number) => (
                                        <li key={i} className="flex gap-3 text-sm">
                                            <span className="shrink-0 px-2 py-0.5 rounded bg-red-500/20 text-red-300 font-mono text-xs h-fit mt-0.5 border border-red-500/30">
                                                {f.type || 'FALLACY'}
                                            </span>
                                            <span className="text-slate-300">{f.description || JSON.stringify(f)}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-slate-500 italic">No logical fallacies detected in sources.</p>
                            )}
                        </div>

                        {/* Bias Analysis */}
                        <div className="p-6 rounded-xl bg-white/5 border border-white/10">
                            <h3 className="text-lg font-bold text-white mb-4">Bias Landscape</h3>
                            <div className="prose prose-invert prose-sm max-w-none text-slate-300">
                                {analysisReport.biasAnalysis || "No bias analysis available."}
                            </div>
                        </div>

                        {/* Raw JSON Debug (for transparency) */}
                        <details className="group">
                            <summary className="flex items-center gap-2 text-xs font-mono text-slate-600 cursor-pointer hover:text-slate-400 transition-colors">
                                <FileJson className="w-3 h-3" />
                                VIEW RAW ANALYSIS DATA
                            </summary>
                            <pre className="mt-4 p-4 rounded bg-black/50 text-[10px] text-slate-500 overflow-x-auto border border-white/5">
                                {JSON.stringify(analysisReport, null, 2)}
                            </pre>
                        </details>
                    </div>
                )}

                {activeTab === 'watch' && videoMaterial && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-8">
                        <div className="p-6 rounded-xl bg-white/5 border border-white/10">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <Play className="w-5 h-5 text-primary-400" />
                                Video Script (60s)
                            </h3>
                            <div className="font-mono text-sm whitespace-pre-wrap text-slate-300 leading-relaxed border-l-2 border-primary-500/30 pl-4">
                                {videoMaterial.script60s || "No script available."}
                            </div>
                        </div>

                        {videoMaterial.keyQuotes && (
                            <div className="p-6 rounded-xl bg-white/5 border border-white/10">
                                <h3 className="text-lg font-bold text-white mb-4">Key Soundbites</h3>
                                <div className="grid gap-4">
                                    {Array.isArray(videoMaterial.keyQuotes) && videoMaterial.keyQuotes.map((q: any, i: number) => (
                                        <div key={i} className="p-4 rounded bg-black/20 border border-white/5 italic text-slate-400">
                                            "{typeof q === 'string' ? q : q.text || JSON.stringify(q)}"
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
