"use client"

import { useState } from 'react'
import { Signal } from '@/types'
import { analyzeSignalAction } from '@/app/actions'
import { Zap, Loader2, FileText, Video, ExternalLink } from 'lucide-react'

export default function SignalCard({ signal }: { signal: Signal }) {
  const [analysis, setAnalysis] = useState<{ summary: string; script: string } | null>(null)
  const [loading, setLoading] = useState(false)

  const handleAnalyze = async () => {
    setLoading(true)
    try {
      const result = await analyzeSignalAction(signal.headline, signal.summary || signal.headline)
      setAnalysis(result)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="group hover:bg-white/[0.02] transition-colors p-6 border-b border-white/5 last:border-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400/80 border border-cyan-500/20 px-1.5 py-0.5 rounded">
              {signal.source}
            </span>
            {analysis && (
              <span className="text-[10px] font-mono uppercase tracking-wider text-purple-400/80 border border-purple-500/20 px-1.5 py-0.5 rounded flex items-center gap-1">
                <Zap className="w-3 h-3" /> Analyzed
              </span>
            )}
            <h3 className="font-medium text-white truncate text-lg">{signal.headline}</h3>
          </div>

          {/* Summary / Content */}
          <p className="text-xs text-gray-400 mb-2 line-clamp-2">{signal.summary}</p>

          {/* Metadata */}
          <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
            <span>{new Date(signal.publishedAt).toLocaleTimeString()}</span>
            {signal.entities.length > 0 && (
              <div className="flex gap-1">
                {signal.entities.slice(0, 2).map((e, i) => (
                  <span key={i} className="px-1.5 py-0.5 rounded bg-white/5 text-gray-300">{e}</span>
                ))}
              </div>
            )}
            <a
              href={signal.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors flex items-center gap-1 ml-2"
            >
              Source <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* AI Analysis Result Area */}
          {analysis && (
            <div className="mt-4 p-4 rounded-xl bg-cyan-900/10 border border-cyan-500/20 text-sm animate-in fade-in slide-in-from-top-2">
              <div className="flex items-start gap-3 mb-3">
                <FileText className="w-4 h-4 text-cyan-400 mt-0.5" />
                <div>
                  <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider block mb-1">Briefing</span>
                  <p className="text-gray-300 leading-relaxed">{analysis.summary}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Video className="w-4 h-4 text-pink-400 mt-0.5" />
                <div>
                  <span className="text-xs font-bold text-pink-400 uppercase tracking-wider block mb-1">TikTok Script</span>
                  <p className="text-gray-400 font-mono text-xs leading-relaxed whitespace-pre-wrap border-l-2 border-pink-500/30 pl-3">
                    {analysis.script}
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Action Button */}
        <button
          onClick={handleAnalyze}
          disabled={loading || !!analysis}
          className="p-2 rounded-full hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed group/btn min-w-[32px] flex justify-center"
          title="Analyze with AI"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
          ) : (
            <Zap className={`w-4 h-4 ${analysis ? 'text-green-400' : 'text-gray-500 group-hover/btn:text-cyan-400'} transition-colors`} />
          )}
        </button>
      </div>
    </div>
  )
}
