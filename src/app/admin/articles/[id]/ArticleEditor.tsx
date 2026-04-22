'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Article } from '@/types/database'

export default function ArticleEditor({ article }: { article: Article }) {
  const router = useRouter()
  const [title, setTitle] = useState(article.title)
  const [summary, setSummary] = useState(article.summary ?? '')
  const [content, setContent] = useState(article.content)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [publishing, setPublishing] = useState(false)

  async function save() {
    setSaving(true)
    setSaved(false)
    await fetch(`/api/articles/${article.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, summary: summary || null, content }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function togglePublish() {
    setPublishing(true)
    const newStatus = article.status === 'published' ? 'draft' : 'published'
    await fetch(`/api/articles/${article.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    setPublishing(false)
    router.refresh()
  }

  async function deleteArticle() {
    if (!confirm('Delete this article? This cannot be undone.')) return
    await fetch(`/api/articles/${article.id}`, { method: 'DELETE' })
    router.push('/admin/articles')
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <label className="font-mono text-xs text-text-secondary">TITLE</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="input-field font-display text-base"
        />
      </div>

      <div className="space-y-1">
        <label className="font-mono text-xs text-text-secondary">SUMMARY</label>
        <input
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          className="input-field"
          placeholder="One-sentence summary"
        />
      </div>

      <div className="space-y-1">
        <label className="font-mono text-xs text-text-secondary">CONTENT (Markdown)</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={28}
          className="input-field font-mono text-xs resize-y"
        />
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-50">
          {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save'}
        </button>
        <button onClick={togglePublish} disabled={publishing}
          className={`font-mono text-xs px-4 py-2 rounded-sm border transition-colors disabled:opacity-50 ${
            article.status === 'published'
              ? 'border-text-muted text-text-muted hover:border-disputed hover:text-disputed'
              : 'border-confirmed/30 text-confirmed hover:bg-confirmed/10'
          }`}>
          {publishing ? '...' : article.status === 'published' ? 'Unpublish' : 'Publish'}
        </button>
        <button onClick={deleteArticle}
          className="font-mono text-xs text-text-muted hover:text-disputed transition-colors ml-auto">
          Delete
        </button>
      </div>
    </div>
  )
}
