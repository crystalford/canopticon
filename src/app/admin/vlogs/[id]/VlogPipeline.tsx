'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, Play, CheckCircle, AlertCircle, Loader2, ExternalLink } from 'lucide-react'

interface Vlog {
  id: string
  title: string
  youtube_url: string | null
  script: string | null
  transcript: string | null
  status: string
  processing_status: string
  processing_error: string | null
  r2_key: string | null
  intake_ids: string[]
  published_at: string | null
  created_at: string
}

export default function VlogPipeline({ vlog: initial }: { vlog: Vlog }) {
  const router = useRouter()
  const [vlog, setVlog] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [title, setTitle] = useState(initial.title)
  const [youtubeUrl, setYoutubeUrl] = useState(initial.youtube_url ?? '')
  const [script, setScript] = useState(initial.script ?? '')
  const [manualTranscript, setManualTranscript] = useState('')
  const [activeTab, setActiveTab] = useState<'details' | 'transcript' | 'script'>('details')

  async function save() {
    setSaving(true)
    await fetch(`/api/vlogs/${vlog.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, youtube_url: youtubeUrl || null, script: script || null }),
    })
    setSaving(false)
    router.refresh()
  }

  async function uploadVideo(file: File) {
    setUploading(true)
    // Get presigned URL
    const res = await fetch(`/api/vlogs/${vlog.id}/upload`, { method: 'POST' })
    const { upload_url } = await res.json()
    if (!upload_url) { setUploading(false); return }

    // Upload directly to R2
    await fetch(upload_url, { method: 'PUT', body: file, headers: { 'Content-Type': 'video/mp4' } })
    setUploading(false)
    router.refresh()
  }

  async function processVlog() {
    setProcessing(true)
    const res = await fetch(`/api/vlogs/${vlog.id}/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript: manualTranscript || undefined }),
    })
    const json = await res.json()
    setProcessing(false)
    if (json.ok) {
      setVlog({ ...vlog, processing_status: 'done' })
      router.refresh()
    }
  }

  async function togglePublish() {
    const newStatus = vlog.status === 'published' ? 'draft' : 'published'
    await fetch(`/api/vlogs/${vlog.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    setVlog({ ...vlog, status: newStatus })
    router.refresh()
  }

  const pipelineReady = vlog.youtube_url || vlog.r2_key || manualTranscript || vlog.script

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex border-b border-border">
        {(['details', 'transcript', 'script'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`font-mono text-xs px-4 py-2 border-b-2 transition-colors capitalize ${
              activeTab === tab ? 'border-signal text-signal' : 'border-transparent text-text-muted hover:text-text-secondary'
            }`}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'details' && (
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="font-mono text-xs text-text-secondary">TITLE</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input-field font-display text-base" />
          </div>
          <div className="space-y-1">
            <label className="font-mono text-xs text-text-secondary">YOUTUBE URL</label>
            <input value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} className="input-field" placeholder="https://youtube.com/watch?v=..." />
            <p className="font-mono text-[10px] text-text-muted">If set, transcript will be pulled from YouTube auto-captions automatically.</p>
          </div>

          {/* Upload video to R2 */}
          <div className="space-y-2">
            <label className="font-mono text-xs text-text-secondary">UPLOAD VIDEO TO R2</label>
            <div className="border border-dashed border-border rounded-sm p-6 text-center">
              {vlog.r2_key ? (
                <div className="flex items-center justify-center gap-2 text-confirmed">
                  <CheckCircle size={14} />
                  <span className="font-mono text-xs">Uploaded: {vlog.r2_key}</span>
                </div>
              ) : (
                <>
                  <Upload size={20} className="mx-auto text-text-muted mb-2" />
                  <label className="cursor-pointer">
                    <span className="font-mono text-xs text-signal hover:underline">
                      {uploading ? 'Uploading...' : 'Choose MP4 file'}
                    </span>
                    <input
                      type="file" accept="video/mp4,video/*" className="hidden"
                      disabled={uploading}
                      onChange={(e) => e.target.files?.[0] && uploadVideo(e.target.files[0])}
                    />
                  </label>
                  <p className="font-mono text-[10px] text-text-muted mt-1">Uploads directly to R2 — not through the server</p>
                </>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-50">
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={togglePublish}
              className={`font-mono text-xs px-4 py-2 rounded-sm border transition-colors ${
                vlog.status === 'published'
                  ? 'border-text-muted text-text-muted hover:border-disputed hover:text-disputed'
                  : 'border-confirmed/30 text-confirmed hover:bg-confirmed/10'
              }`}>
              {vlog.status === 'published' ? 'Unpublish' : 'Publish'}
            </button>
            {vlog.youtube_url && (
              <a href={vlog.youtube_url} target="_blank" rel="noopener noreferrer"
                className="font-mono text-xs text-text-muted hover:text-signal transition-colors flex items-center gap-1 ml-auto">
                <ExternalLink size={12} /> YouTube
              </a>
            )}
          </div>
        </div>
      )}

      {activeTab === 'transcript' && (
        <div className="space-y-4">
          {/* Pipeline status */}
          <div className={`glass-panel p-4 flex items-start gap-3 ${
            vlog.processing_status === 'done' ? 'border-confirmed/30' :
            vlog.processing_status === 'error' ? 'border-disputed/30' : ''
          }`}>
            {vlog.processing_status === 'done' ? <CheckCircle size={16} className="text-confirmed shrink-0 mt-0.5" /> :
             vlog.processing_status === 'error' ? <AlertCircle size={16} className="text-disputed shrink-0 mt-0.5" /> :
             <div className="w-4 h-4 rounded-full border border-border shrink-0 mt-0.5" />}
            <div>
              <p className="font-mono text-xs text-text-primary">
                {vlog.processing_status === 'done'
                  ? `Processed → ${vlog.intake_ids?.length ?? 0} intake item(s) created`
                  : vlog.processing_status === 'error'
                  ? vlog.processing_error ?? 'Processing error'
                  : 'Not yet processed'}
              </p>
              {vlog.processing_status === 'done' && vlog.intake_ids?.length > 0 && (
                <p className="font-mono text-[10px] text-text-muted mt-1">
                  Run <span className="text-signal">Intake Classifier</span> from the System panel to extract entities and build the graph.
                </p>
              )}
            </div>
          </div>

          {vlog.transcript ? (
            <div className="space-y-2">
              <label className="font-mono text-xs text-text-secondary">EXTRACTED TRANSCRIPT</label>
              <textarea value={vlog.transcript} readOnly rows={16} className="input-field font-mono text-xs resize-y opacity-70" />
            </div>
          ) : (
            <div className="space-y-2">
              <label className="font-mono text-xs text-text-secondary">PASTE TRANSCRIPT (optional)</label>
              <textarea
                value={manualTranscript}
                onChange={(e) => setManualTranscript(e.target.value)}
                rows={12}
                className="input-field font-mono text-xs resize-y"
                placeholder="Paste transcript here, or leave blank to pull from YouTube auto-captions..."
              />
            </div>
          )}

          <button
            onClick={processVlog}
            disabled={processing || !pipelineReady}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            {processing ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            {processing ? 'Processing...' : 'Extract Intelligence → Intake Queue'}
          </button>
          <p className="font-mono text-[10px] text-text-muted">
            Extracts transcript from YouTube or uses pasted text, summarizes with Claude, pushes to intake queue.
          </p>
        </div>
      )}

      {activeTab === 'script' && (
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="font-mono text-xs text-text-secondary">SCRIPT</label>
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              rows={28}
              className="input-field font-mono text-xs resize-y"
              placeholder="Script for this video — generated or manually written..."
            />
          </div>
          <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Script'}
          </button>
        </div>
      )}
    </div>
  )
}
