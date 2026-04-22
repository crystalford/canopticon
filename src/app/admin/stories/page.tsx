'use client'

import { useState } from 'react'
import { Loader2, RefreshCw, FileText, AlertTriangle, CheckCircle, Minus } from 'lucide-react'
import Link from 'next/link'

interface StoryPitch {
  title: string
  why_now: string
  structural_finding: string
  evidence_strength: 'strong' | 'moderate' | 'weak'
  knowledge_gaps: string[]
  angle: string
  suggested_entities: string[]
}

interface StoryResult {
  stories: StoryPitch[]
  lookback_days: number
  generated_at: string
}

const STRENGTH_CONFIG = {
  strong: { icon: <CheckCircle size={12} />, color: 'text-confirmed', label: 'Strong evidence' },
  moderate: { icon: <Minus size={12} />, color: 'text-hypothesis', label: 'Moderate evidence' },
  weak: { icon: <AlertTriangle size={12} />, color: 'text-disputed', label: 'Weak evidence' },
}

export default function StoriesPage() {
  const [result, setResult] = useState<StoryResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [lookback, setLookback] = useState(7)
  const [draftingStory, setDraftingStory] = useState<string | null>(null)
  const [draftLinks, setDraftLinks] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  async function findStories() {
    setLoading(true)
    setError(null)
    setResult(null)

    const res = await fetch('/api/story-finder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lookback_days: lookback }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Story finder failed')
    } else {
      setResult(data)
    }
    setLoading(false)
  }

  async function draftScript(story: StoryPitch) {
    setDraftingStory(story.title)
    setError(null)

    const res = await fetch('/api/vlogs/draft-from-story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ story }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Script generation failed')
    } else if (data.redirect) {
      setDraftLinks((prev) => ({ ...prev, [story.title]: data.redirect }))
    }
    setDraftingStory(null)
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-text-primary">Story Finder</h1>
          <p className="font-mono text-xs text-text-muted mt-1">
            Surfaces story threads from recent graph activity. Each pitch includes evidence strength and knowledge gaps.
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="glass-panel p-4 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="font-mono text-xs text-text-muted">Lookback:</label>
          {[3, 7, 14, 30].map((days) => (
            <button
              key={days}
              onClick={() => setLookback(days)}
              className={`font-mono text-xs px-2.5 py-1 rounded-sm border transition-colors ${
                lookback === days
                  ? 'border-signal bg-signal/10 text-signal'
                  : 'border-border text-text-muted hover:border-signal/30'
              }`}
            >
              {days}d
            </button>
          ))}
        </div>
        <button
          onClick={findStories}
          disabled={loading}
          className="btn-primary flex items-center gap-2 px-4 py-2 font-mono text-xs disabled:opacity-50 ml-auto"
        >
          {loading
            ? <><Loader2 size={12} className="animate-spin" /> Scanning graph...</>
            : <><RefreshCw size={12} /> Find stories</>}
        </button>
      </div>

      {error && (
        <div className="glass-panel p-4 border-disputed/30">
          <p className="font-mono text-xs text-disputed">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-mono text-xs text-text-muted">
              {result.stories.length} threads found · {result.lookback_days}d lookback ·{' '}
              {new Date(result.generated_at).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          {result.stories.length === 0 ? (
            <div className="glass-panel p-8 text-center font-mono text-xs text-text-muted">
              No defensible story threads found in the last {result.lookback_days} days. The graph needs more data.
            </div>
          ) : (
            result.stories.map((story, i) => {
              const strength = STRENGTH_CONFIG[story.evidence_strength] ?? STRENGTH_CONFIG.moderate
              const draftLink = draftLinks[story.title]
              const isDrafting = draftingStory === story.title

              return (
                <div key={i} className="glass-panel p-5 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`flex items-center gap-1 font-mono text-[10px] ${strength.color}`}>
                          {strength.icon} {strength.label}
                        </span>
                        <span className="font-mono text-[10px] text-text-muted border border-border px-1.5 py-0.5 rounded-sm">
                          {story.angle}
                        </span>
                      </div>
                      <h2 className="font-display text-base font-semibold text-text-primary leading-snug">{story.title}</h2>
                    </div>
                    {draftLink ? (
                      <Link
                        href={draftLink}
                        className="font-mono text-xs text-confirmed hover:underline flex items-center gap-1 shrink-0"
                      >
                        ✓ Script created →
                      </Link>
                    ) : (
                      <button
                        onClick={() => draftScript(story)}
                        disabled={!!draftingStory}
                        className="flex items-center gap-1.5 font-mono text-xs px-3 py-1.5 rounded-sm border border-border text-text-secondary hover:border-signal/40 hover:text-signal transition-colors disabled:opacity-50 shrink-0"
                      >
                        {isDrafting
                          ? <><Loader2 size={12} className="animate-spin" /> Drafting...</>
                          : <><FileText size={12} /> Draft script</>}
                      </button>
                    )}
                  </div>

                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="font-mono text-[10px] text-signal uppercase tracking-wider mb-1">Why now</p>
                      <p className="font-body text-text-secondary leading-relaxed">{story.why_now}</p>
                    </div>
                    <div>
                      <p className="font-mono text-[10px] text-hypothesis uppercase tracking-wider mb-1">Structural finding</p>
                      <p className="font-body text-text-primary leading-relaxed">{story.structural_finding}</p>
                    </div>
                    {story.knowledge_gaps.length > 0 && (
                      <div>
                        <p className="font-mono text-[10px] text-disputed uppercase tracking-wider mb-1">Knowledge gaps</p>
                        <ul className="space-y-0.5">
                          {story.knowledge_gaps.map((gap, j) => (
                            <li key={j} className="font-mono text-xs text-text-muted flex items-start gap-1.5">
                              <span className="text-disputed mt-0.5">·</span> {gap}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {story.suggested_entities.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {story.suggested_entities.map((name, j) => (
                          <span key={j} className="font-mono text-[10px] bg-raised border border-border text-text-muted px-2 py-0.5 rounded-sm">
                            {name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {!result && !loading && (
        <div className="glass-panel p-8 text-center space-y-2">
          <p className="font-mono text-xs text-text-muted">Scan the graph to surface story threads with defensible evidence.</p>
          <p className="font-mono text-xs text-text-muted opacity-60">Uses recent entities, claims, convergences, and knowledge gaps.</p>
        </div>
      )}
    </div>
  )
}
