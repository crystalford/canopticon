'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ArgumentMap, DominantFrame, FiveWhysEntry, BankedPrediction } from '@/types/database'
import { Trash2, Plus, Check } from 'lucide-react'

const TYPES = ['analysis', 'five_whys', 'solution_inventory', 'prediction', 'thesis'] as const

export default function ArgumentMapEditor({ map }: { map: ArgumentMap }) {
  const router = useRouter()
  const [title, setTitle] = useState(map.title)
  const [articleType, setArticleType] = useState(map.article_type)
  const [rootClaim, setRootClaim] = useState(map.argument_tree?.claim ?? '')
  const [rootConfidence, setRootConfidence] = useState(map.argument_tree?.confidence ?? 0.5)

  const [frames, setFrames] = useState<DominantFrame[]>(map.dominant_frames ?? [])
  const [newFrame, setNewFrame] = useState({ frame_name: '', description: '', who_benefits: '' })

  const [reform, setReform] = useState<string[]>(map.solution_inventory?.reform ?? [])
  const [resistance, setResistance] = useState<string[]>(map.solution_inventory?.resistance ?? [])
  const [exit, setExit] = useState<string[]>(map.solution_inventory?.exit ?? [])
  const [newSolution, setNewSolution] = useState({ text: '', axis: 'reform' as 'reform' | 'resistance' | 'exit' })

  const [predictions, setPredictions] = useState<BankedPrediction[]>(map.banked_predictions ?? [])
  const [newPred, setNewPred] = useState({ claim: '', probability: 0.5, resolution_date: '' })

  const [whys, setWhys] = useState<FiveWhysEntry[]>(map.five_whys ?? [])
  const [newWhy, setNewWhy] = useState({ question: '', answer: '' })

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [publishing, setPublishing] = useState(false)

  function addFrame() {
    if (!newFrame.frame_name) return
    setFrames([...frames, { ...newFrame }])
    setNewFrame({ frame_name: '', description: '', who_benefits: '' })
  }

  function addSolution() {
    if (!newSolution.text) return
    if (newSolution.axis === 'reform') setReform([...reform, newSolution.text])
    else if (newSolution.axis === 'resistance') setResistance([...resistance, newSolution.text])
    else setExit([...exit, newSolution.text])
    setNewSolution({ text: '', axis: 'reform' })
  }

  function addPrediction() {
    if (!newPred.claim || !newPred.resolution_date) return
    setPredictions([...predictions, { ...newPred, resolved: false }])
    setNewPred({ claim: '', probability: 0.5, resolution_date: '' })
  }

  function resolvePrediction(i: number, outcome: string) {
    const updated = [...predictions]
    updated[i] = { ...updated[i], resolved: true, outcome }
    setPredictions(updated)
  }

  function addWhy() {
    if (!newWhy.question || !newWhy.answer) return
    setWhys([...whys, { ...newWhy, level: whys.length + 1 }])
    setNewWhy({ question: '', answer: '' })
  }

  async function save() {
    setSaving(true)
    setSaved(false)
    await fetch(`/api/argument-maps/${map.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        article_type: articleType,
        argument_tree: rootClaim ? { claim: rootClaim, confidence: rootConfidence, children: map.argument_tree?.children ?? [] } : {},
        dominant_frames: frames,
        solution_inventory: { reform, resistance, exit },
        banked_predictions: predictions,
        five_whys: whys,
      }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function togglePublish() {
    setPublishing(true)
    const newStatus = map.status === 'published' ? 'draft' : 'published'
    await fetch(`/api/argument-maps/${map.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    setPublishing(false)
    router.refresh()
  }

  async function deleteMap() {
    if (!confirm('Delete this argument map? This cannot be undone.')) return
    await fetch(`/api/argument-maps/${map.id}`, { method: 'DELETE' })
    router.push('/admin/argument-maps')
  }

  return (
    <div className="space-y-6">
      {/* Core */}
      <section className="glass-panel p-6 space-y-4">
        <h2 className="font-display text-sm font-semibold text-text-secondary tracking-wider uppercase">Core</h2>
        <div className="space-y-1">
          <label className="font-mono text-xs text-text-secondary">TITLE</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="input-field font-display text-base" />
        </div>
        <div className="space-y-1">
          <label className="font-mono text-xs text-text-secondary">TYPE</label>
          <select value={articleType} onChange={(e) => setArticleType(e.target.value as typeof articleType)} className="input-field">
            {TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
          </select>
        </div>
      </section>

      {/* Root Claim */}
      <section className="glass-panel p-6 space-y-4">
        <h2 className="font-display text-sm font-semibold text-text-secondary tracking-wider uppercase">Root Claim</h2>
        <div className="space-y-1">
          <label className="font-mono text-xs text-text-secondary">CLAIM</label>
          <textarea value={rootClaim} onChange={(e) => setRootClaim(e.target.value)} rows={3} className="input-field font-mono text-xs resize-y" />
        </div>
        <div className="space-y-1">
          <label className="font-mono text-xs text-text-secondary">CONFIDENCE — {Math.round(rootConfidence * 100)}%</label>
          <input type="range" min={0} max={1} step={0.01} value={rootConfidence} onChange={(e) => setRootConfidence(parseFloat(e.target.value))} className="w-full accent-signal" />
        </div>
      </section>

      {/* Dominant Frames */}
      <section className="glass-panel p-6 space-y-4">
        <h2 className="font-display text-sm font-semibold text-text-secondary tracking-wider uppercase">Dominant Frames</h2>
        {frames.map((f, i) => (
          <div key={i} className="bg-void border border-border rounded-sm p-3 flex justify-between items-start gap-3">
            <div>
              <p className="font-mono text-xs text-signal">{f.frame_name}</p>
              <p className="font-mono text-xs text-text-muted mt-1">{f.description}</p>
              <p className="font-mono text-xs text-text-muted">Benefits: {f.who_benefits}</p>
            </div>
            <button onClick={() => setFrames(frames.filter((_, j) => j !== i))} className="text-text-muted hover:text-disputed shrink-0"><Trash2 size={13} /></button>
          </div>
        ))}
        <div className="space-y-2 border-t border-border pt-4">
          <input value={newFrame.frame_name} onChange={(e) => setNewFrame({ ...newFrame, frame_name: e.target.value })} className="input-field" placeholder="Frame name" />
          <input value={newFrame.description} onChange={(e) => setNewFrame({ ...newFrame, description: e.target.value })} className="input-field" placeholder="Description" />
          <input value={newFrame.who_benefits} onChange={(e) => setNewFrame({ ...newFrame, who_benefits: e.target.value })} className="input-field" placeholder="Who benefits from this frame?" />
          <button onClick={addFrame} className="btn-secondary flex items-center gap-2"><Plus size={13} /> Add Frame</button>
        </div>
      </section>

      {/* Solution Inventory */}
      <section className="glass-panel p-6 space-y-4">
        <h2 className="font-display text-sm font-semibold text-text-secondary tracking-wider uppercase">Solution Inventory</h2>
        {(['reform', 'resistance', 'exit'] as const).map((axis) => {
          const items = axis === 'reform' ? reform : axis === 'resistance' ? resistance : exit
          const setter = axis === 'reform' ? setReform : axis === 'resistance' ? setResistance : setExit
          return (
            <div key={axis}>
              <p className="font-mono text-xs text-text-secondary uppercase mb-2">{axis}</p>
              <div className="space-y-1">
                {items.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="font-mono text-xs text-text-muted flex-1">{s}</span>
                    <button onClick={() => setter(items.filter((_, j) => j !== i))} className="text-text-muted hover:text-disputed"><Trash2 size={12} /></button>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
        <div className="flex gap-2 border-t border-border pt-4">
          <select value={newSolution.axis} onChange={(e) => setNewSolution({ ...newSolution, axis: e.target.value as 'reform' | 'resistance' | 'exit' })} className="input-field w-36">
            <option value="reform">Reform</option>
            <option value="resistance">Resistance</option>
            <option value="exit">Exit</option>
          </select>
          <input value={newSolution.text} onChange={(e) => setNewSolution({ ...newSolution, text: e.target.value })} className="input-field flex-1" placeholder="Describe solution..." onKeyDown={(e) => e.key === 'Enter' && addSolution()} />
          <button onClick={addSolution} className="btn-secondary"><Plus size={13} /></button>
        </div>
      </section>

      {/* Five Whys */}
      <section className="glass-panel p-6 space-y-4">
        <h2 className="font-display text-sm font-semibold text-text-secondary tracking-wider uppercase">Five Whys</h2>
        {whys.map((w, i) => (
          <div key={i} className="bg-void border border-border rounded-sm p-3 flex justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] text-signal mb-1">WHY {w.level}</p>
              <p className="font-mono text-xs text-text-primary">{w.question}</p>
              <p className="font-mono text-xs text-text-muted mt-1">→ {w.answer}</p>
            </div>
            <button onClick={() => setWhys(whys.filter((_, j) => j !== i).map((x, k) => ({ ...x, level: k + 1 })))} className="text-text-muted hover:text-disputed shrink-0"><Trash2 size={13} /></button>
          </div>
        ))}
        <div className="space-y-2 border-t border-border pt-4">
          <input value={newWhy.question} onChange={(e) => setNewWhy({ ...newWhy, question: e.target.value })} className="input-field" placeholder={`Why ${whys.length + 1}: question...`} />
          <input value={newWhy.answer} onChange={(e) => setNewWhy({ ...newWhy, answer: e.target.value })} className="input-field" placeholder="Answer..." onKeyDown={(e) => e.key === 'Enter' && addWhy()} />
          <button onClick={addWhy} className="btn-secondary flex items-center gap-2"><Plus size={13} /> Add Why</button>
        </div>
      </section>

      {/* Banked Predictions */}
      <section className="glass-panel p-6 space-y-4">
        <h2 className="font-display text-sm font-semibold text-text-secondary tracking-wider uppercase">Banked Predictions</h2>
        {predictions.map((p, i) => (
          <div key={i} className="bg-void border border-border rounded-sm p-3 flex justify-between gap-3">
            <div className="flex-1">
              <p className="font-mono text-xs text-text-primary">{p.claim}</p>
              <p className="font-mono text-[10px] text-text-muted mt-1">
                {Math.round(p.probability * 100)}% · Resolves {p.resolution_date}
                {p.resolved && <span className="text-confirmed ml-2">✓ {p.outcome}</span>}
              </p>
              {!p.resolved && (
                <div className="flex gap-2 mt-2">
                  <button onClick={() => resolvePrediction(i, 'correct')} className="font-mono text-[10px] text-confirmed border border-confirmed/30 px-2 py-0.5 rounded-sm hover:bg-confirmed/10 flex items-center gap-1"><Check size={10} /> Correct</button>
                  <button onClick={() => resolvePrediction(i, 'incorrect')} className="font-mono text-[10px] text-disputed border border-disputed/30 px-2 py-0.5 rounded-sm hover:bg-disputed/10">✗ Incorrect</button>
                </div>
              )}
            </div>
            <button onClick={() => setPredictions(predictions.filter((_, j) => j !== i))} className="text-text-muted hover:text-disputed shrink-0"><Trash2 size={13} /></button>
          </div>
        ))}
        <div className="space-y-2 border-t border-border pt-4">
          <textarea value={newPred.claim} onChange={(e) => setNewPred({ ...newPred, claim: e.target.value })} rows={2} className="input-field font-mono text-xs resize-none" placeholder="Prediction claim..." />
          <div className="flex gap-3 items-center">
            <div className="flex-1 space-y-1">
              <label className="font-mono text-[10px] text-text-muted">PROBABILITY — {Math.round(newPred.probability * 100)}%</label>
              <input type="range" min={0} max={1} step={0.01} value={newPred.probability} onChange={(e) => setNewPred({ ...newPred, probability: parseFloat(e.target.value) })} className="w-full accent-signal" />
            </div>
            <div className="space-y-1">
              <label className="font-mono text-[10px] text-text-muted">RESOLVES</label>
              <input type="date" value={newPred.resolution_date} onChange={(e) => setNewPred({ ...newPred, resolution_date: e.target.value })} className="input-field" />
            </div>
          </div>
          <button onClick={addPrediction} className="btn-secondary flex items-center gap-2"><Plus size={13} /> Bank Prediction</button>
        </div>
      </section>

      <div className="flex items-center gap-3 pt-2">
        <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-50">
          {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save'}
        </button>
        <button onClick={togglePublish} disabled={publishing}
          className={`font-mono text-xs px-4 py-2 rounded-sm border transition-colors disabled:opacity-50 ${
            map.status === 'published'
              ? 'border-text-muted text-text-muted hover:border-disputed hover:text-disputed'
              : 'border-confirmed/30 text-confirmed hover:bg-confirmed/10'
          }`}>
          {publishing ? '...' : map.status === 'published' ? 'Unpublish' : 'Publish'}
        </button>
        <button onClick={deleteMap} className="font-mono text-xs text-text-muted hover:text-disputed transition-colors ml-auto">
          Delete
        </button>
      </div>
    </div>
  )
}
