'use client'

import { useState } from 'react'
import { Loader2, Sparkles, FileText, CheckCircle, AlertCircle } from 'lucide-react'

interface Topic {
  id: string
  title: string
  description: string
  angle: string
  keywords: string[]
  urgency: 'high' | 'medium' | 'low'
}

interface Article {
  id: string
  title: string
  slug: string
  summary: string
  content: string
  isDraft: boolean
}

export default function ControlPanel() {
  const [topics, setTopics] = useState<Topic[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [findingTopics, setFindingTopics] = useState(false)
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const [publishingId, setPublishingId] = useState<string | null>(null)
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const findTopics = async () => {
    setFindingTopics(true)
    setMessage(null)
    try {
      const res = await fetch('/api/topics/find', { method: 'POST' })
      const data = await res.json()
      
      if (data.success) {
        setTopics(data.topics)
        setMessage({ type: 'success', text: `Found ${data.topics.length} topics` })
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to find topics' })
      }
    } catch (error) {
      console.error('[v0] Find topics error:', error)
      setMessage({ type: 'error', text: 'Failed to find topics' })
    } finally {
      setFindingTopics(false)
    }
  }

  const generateArticle = async (topic: Topic) => {
    setGeneratingId(topic.id)
    setMessage(null)
    try {
      const res = await fetch('/api/topics/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic })
      })
      const data = await res.json()
      
      if (data.success) {
        setArticles(prev => [data.article, ...prev])
        setMessage({ type: 'success', text: 'Article generated successfully!' })
        // Remove topic from list
        setTopics(prev => prev.filter(t => t.id !== topic.id))
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to generate article' })
      }
    } catch (error) {
      console.error('[v0] Generate article error:', error)
      setMessage({ type: 'error', text: 'Failed to generate article' })
    } finally {
      setGeneratingId(null)
    }
  }

  const publishArticle = async (article: Article) => {
    setPublishingId(article.id)
    setMessage(null)
    try {
      const res = await fetch('/api/articles/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: article.id })
      })
      const data = await res.json()
      
      if (data.success) {
        setArticles(prev => prev.map(a => 
          a.id === article.id ? { ...a, isDraft: false } : a
        ))
        setMessage({ type: 'success', text: 'Article published!' })
        setSelectedArticle(null)
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to publish' })
      }
    } catch (error) {
      console.error('[v0] Publish error:', error)
      setMessage({ type: 'error', text: 'Failed to publish article' })
    } finally {
      setPublishingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Control Panel</h1>
            <p className="text-slate-400 mt-2">AI-powered article generation made simple</p>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className={`p-4 rounded-lg flex items-center gap-2 ${
            message.type === 'success' ? 'bg-green-900/30 border border-green-700 text-green-300' :
            'bg-red-900/30 border border-red-700 text-red-300'
          }`}>
            {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            {message.text}
          </div>
        )}

        {/* Step 1: Find Topics */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold">Step 1: Find Topics</h2>
              <p className="text-slate-400 text-sm mt-1">AI researches current political topics</p>
            </div>
            <button
              onClick={findTopics}
              disabled={findingTopics}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed rounded font-medium flex items-center gap-2 transition-colors"
            >
              {findingTopics ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Researching...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Find Topics
                </>
              )}
            </button>
          </div>

          {topics.length > 0 && (
            <div className="space-y-3 mt-4">
              {topics.map(topic => (
                <div key={topic.id} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h3 className="font-semibold">{topic.title}</h3>
                        <span className={`px-2 py-0.5 text-xs rounded font-medium ${
                          topic.urgency === 'high' ? 'bg-red-600/20 text-red-300' :
                          topic.urgency === 'medium' ? 'bg-yellow-600/20 text-yellow-300' : 
                          'bg-slate-600/20 text-slate-300'
                        }`}>
                          {topic.urgency}
                        </span>
                      </div>
                      <p className="text-sm text-slate-400 mb-2">{topic.description}</p>
                      <p className="text-xs text-slate-500 italic mb-2">
                        <span className="font-medium">Angle:</span> {topic.angle}
                      </p>
                      <div className="flex gap-1 flex-wrap">
                        {topic.keywords.map(kw => (
                          <span key={kw} className="px-2 py-0.5 bg-slate-700 text-slate-300 text-xs rounded">{kw}</span>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => generateArticle(topic)}
                      disabled={generatingId === topic.id}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 disabled:cursor-not-allowed rounded font-medium flex items-center gap-2 transition-colors shrink-0"
                    >
                      {generatingId === topic.id ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Writing...
                        </>
                      ) : (
                        <>
                          <FileText className="w-4 h-4" />
                          Generate
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {topics.length === 0 && !findingTopics && (
            <p className="text-sm text-slate-500 mt-4">No topics yet. Click "Find Topics" to start.</p>
          )}
        </div>

        {/* Step 2: Review & Publish */}
        {articles.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">Step 2: Review & Publish</h2>
            <div className="space-y-3">
              {articles.filter(a => a.isDraft).map(article => (
                <div key={article.id} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1">{article.title}</h3>
                      <p className="text-sm text-slate-400 mb-2">{article.summary}</p>
                      <p className="text-xs text-slate-500">/{article.slug}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => setSelectedArticle(article)}
                        className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded font-medium text-sm transition-colors"
                      >
                        Preview
                      </button>
                      <button
                        onClick={() => publishArticle(article)}
                        disabled={publishingId === article.id}
                        className="px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 disabled:cursor-not-allowed rounded font-medium text-sm flex items-center gap-2 transition-colors"
                      >
                        {publishingId === article.id ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Publishing...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            Publish
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Article Preview Modal */}
        {selectedArticle && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50" onClick={() => setSelectedArticle(null)}>
            <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between mb-4">
                <h2 className="text-2xl font-bold">{selectedArticle.title}</h2>
                <button 
                  onClick={() => setSelectedArticle(null)}
                  className="text-slate-400 hover:text-white text-2xl"
                >
                  ×
                </button>
              </div>
              <p className="text-slate-400 italic mb-4">{selectedArticle.summary}</p>
              <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: selectedArticle.content }} />
              <div className="flex gap-3 mt-6 pt-6 border-t border-slate-800">
                <button
                  onClick={() => setSelectedArticle(null)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded font-medium transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => publishArticle(selectedArticle)}
                  disabled={publishingId === selectedArticle.id}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 disabled:cursor-not-allowed rounded font-medium flex items-center gap-2 transition-colors"
                >
                  {publishingId === selectedArticle.id ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Publishing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Publish Article
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
