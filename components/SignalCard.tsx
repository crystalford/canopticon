"use client"

import { useState, useEffect } from 'react'
import { Signal } from '@/types'
import { analyzeSignalAction, generateImageAction, generateAudioAction, generateXThreadAction, generateArticleAction, getSignalPublicationsAction, updateSignalStatusAction, generateInfographicAction } from '@/app/actions'
import { Zap, Loader2, FileText, Video, ExternalLink, ImageIcon, Volume2, Play, BarChart } from 'lucide-react'

export default function SignalCard({ signal, isAdmin = false }: { signal: Signal; isAdmin?: boolean }) {
  const [analysis, setAnalysis] = useState<{ summary: string; script: string } | null>(null)
  const [media, setMedia] = useState<{ imageUrl?: string; audioUrl?: string; thread?: string[]; article?: string }>({})
  const [loading, setLoading] = useState<string | null>(null) // 'analyze' | 'image' | 'audio' | 'thread' | 'article'

  // Hydrate state from DB
  useEffect(() => {
    // Other hydration...
    if (signal.ai_summary) {
      setAnalysis({
        summary: signal.ai_summary,
        script: signal.ai_script || ''
      });
    }

    const loadMedia = async () => {
      const pubs = await getSignalPublicationsAction(signal.id);
      const newMedia: any = {};
      pubs.forEach(p => {
        if (p.type === 'image') newMedia.imageUrl = p.content;
        if (p.type === 'audio') newMedia.audioUrl = p.content;
        if (p.type === 'thread') newMedia.thread = p.content;
        if (p.type === 'article') newMedia.article = p.content;
        if (p.type === 'infographic') newMedia.infographicUrl = p.content;
      });
      setMedia(prev => ({ ...prev, ...newMedia }));
    };
    loadMedia();
  }, [signal]);

  const handleAnalyze = async () => {
    setLoading('analyze')
    try {
      const result = await analyzeSignalAction(signal.headline, signal.summary || signal.headline)
      setAnalysis(result)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(null)
    }
  }

  const handleImage = async () => {
    if (!analysis) return;
    setLoading('image')
    try {
      const url = await generateImageAction(signal.id, signal.headline);
      if (url) setMedia(prev => ({ ...prev, imageUrl: url }));
    } catch (e) { console.error(e) }
    finally { setLoading(null) }
  }

  const handleAudio = async () => {
    if (!analysis?.script) return;
    setLoading('audio')
    try {
      const url = await generateAudioAction(signal.id, analysis.script);
      if (url) setMedia(prev => ({ ...prev, audioUrl: url }));
    } catch (e) { console.error(e) }
    finally { setLoading(null) }
  }

  const handleThread = async () => {
    if (!analysis) return;
    setLoading('thread')
    try {
      const thread = await generateXThreadAction(signal, analysis);
      if (thread) setMedia(prev => ({ ...prev, thread }));
    } catch (e) { console.error(e) }
    finally { setLoading(null) }
  }

  const handleArticle = async () => {
    if (!analysis) return;
    setLoading('article')
    try {
      const article = await generateArticleAction(signal, analysis);
      if (article) setMedia(prev => ({ ...prev, article }));
    } catch (e) { console.error(e) }
    finally { setLoading(null) }
  }

  const handleInfographic = async () => {
    if (!analysis) return;
    setLoading('infographic')
    try {
      const url = await generateInfographicAction(signal.id, signal.headline, analysis.summary);
      if (url) setMedia(prev => ({ ...prev, infographicUrl: url }));
    } catch (e) { console.error(e) }
    finally { setLoading(null) }
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

              {/* Visual Asset (Thumbnail) */}
              {media.imageUrl && (
                <div className="mb-4 rounded-lg overflow-hidden border border-white/10 relative group">
                  <img src={media.imageUrl} alt="Generated Asset" className="w-full h-auto object-cover max-h-64" />
                  <a href={media.imageUrl} download target="_blank" className="absolute top-2 right-2 bg-black/50 p-2 rounded hover:bg-black/80 text-white">
                    <ImageIcon className="w-4 h-4" />
                  </a>
                </div>
              )}

              <div className="flex items-start gap-3 mb-3">
                <FileText className="w-4 h-4 text-cyan-400 mt-0.5" />
                <div>
                  <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider block mb-1">Briefing</span>
                  <p className="text-gray-300 leading-relaxed">{analysis.summary}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 mb-3">
                <Video className="w-4 h-4 text-pink-400 mt-0.5" />
                <div>
                  <span className="text-xs font-bold text-pink-400 uppercase tracking-wider block mb-1">TikTok Script</span>
                  <p className="text-gray-400 font-mono text-xs leading-relaxed whitespace-pre-wrap border-l-2 border-pink-500/30 pl-3 mb-2">
                    {analysis.script}
                  </p>

                  {/* Audio Player */}
                  {media.audioUrl && (
                    <audio controls src={media.audioUrl} className="w-full h-8 mt-2 opacity-80" />
                  )}
                </div>
              </div>

              {/* Thread Result */}
              {media.thread && (
                <div className="mt-3 p-3 bg-black/20 rounded border-l-2 border-blue-500/50">
                  <span className="text-xs font-bold text-blue-400 block mb-2">𝕏 Thread Draft</span>
                  <div className="space-y-2">
                    {media.thread.map((tweet, i) => (
                      <p key={i} className="text-xs text-gray-300 font-mono bg-black/30 p-2 rounded">{tweet}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Article Result */}
              {media.article && (
                <div className="mt-3 p-3 bg-black/20 rounded border-l-2 border-orange-500/50">
                  <span className="text-xs font-bold text-orange-400 block mb-2">Substack Draft</span>
                  <div className="text-xs text-gray-300 font-mono whitespace-pre-wrap h-32 overflow-y-auto custom-scrollbar">
                    {media.article}
                  </div>
                </div>
              )}

              {/* Generation Controls (Admin Only) */}
              {isAdmin && (
                <div className="flex flex-wrap gap-2 mt-3 p-2 bg-white/5 rounded-lg">
                  <button
                    onClick={handleImage} disabled={loading === 'image' || !!media.imageUrl}
                    className="flex items-center gap-2 px-3 py-1.5 rounded bg-black/20 hover:bg-black/40 text-xs font-medium text-purple-300 transition-colors disabled:opacity-50"
                  >
                    {loading === 'image' ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImageIcon className="w-3 h-3" />}
                    Art
                  </button>
                  <button
                    onClick={handleAudio} disabled={loading === 'audio' || !!media.audioUrl}
                    className="flex items-center gap-2 px-3 py-1.5 rounded bg-black/20 hover:bg-black/40 text-xs font-medium text-pink-300 transition-colors disabled:opacity-50"
                  >
                    {loading === 'audio' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Volume2 className="w-3 h-3" />}
                    Voice
                  </button>
                  <div className="w-px h-6 bg-white/10 mx-1"></div>
                  <button
                    onClick={handleThread} disabled={loading === 'thread' || !!media.thread}
                    className="flex items-center gap-2 px-3 py-1.5 rounded bg-black/20 hover:bg-black/40 text-xs font-medium text-blue-400 transition-colors disabled:opacity-50"
                  >
                    {loading === 'thread' ? <Loader2 className="w-3 h-3 animate-spin" /> : <span className="text-xs">𝕏</span>}
                    Thread
                  </button>
                  <button
                    onClick={handleArticle} disabled={loading === 'article' || !!media.article}
                    className="flex items-center gap-2 px-3 py-1.5 rounded bg-black/20 hover:bg-black/40 text-xs font-medium text-orange-400 transition-colors disabled:opacity-50"
                  >
                    {loading === 'article' ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
                    Article
                  </button>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Action Button (Admin Only) */}
        {isAdmin && (
          <div className="flex flex-col gap-2">
            <button
              onClick={handleAnalyze}
              disabled={loading === 'analyze' || !!analysis}
              className="p-2 rounded-full hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed group/btn min-w-[32px] flex justify-center"
              title="Analyze with AI"
            >
              {loading === 'analyze' ? (
                <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
              ) : (
                <Zap className={`w-4 h-4 ${analysis ? 'text-green-400' : 'text-gray-500 group-hover/btn:text-cyan-400'} transition-colors`} />
              )}
            </button>
            <button
              onClick={async () => {
                if (confirm('Publish to live site?')) {
                  setLoading('publish');
                  await updateSignalStatusAction(signal.id, 'published');
                  setLoading(null);
                  // Ideally we'd remove it from view or show success, but for now status update will trigger re-render on refresh
                }
              }}
              disabled={loading === 'publish'}
              className="p-2 rounded-full hover:bg-green-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed group/btn min-w-[32px] flex justify-center"
              title="Publish Signal"
            >
              {loading === 'publish' ? (
                <Loader2 className="w-4 h-4 text-green-400 animate-spin" />
              ) : (
                <ExternalLink className="w-4 h-4 text-gray-500 group-hover/btn:text-green-400 transition-colors" />
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
