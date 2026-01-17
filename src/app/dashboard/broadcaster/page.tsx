'use client'

import React, { useState, useEffect } from 'react'
import { Loader2, Send, Wand2, RefreshCw, AlertCircle, CheckCircle, FileText, Edit3 } from 'lucide-react'

// Types
type Article = {
    id: number
    headline: string
    summary: string
    slug: string
    publishedAt: string
}

type ThreadPost = {
    text: string
    image_prompt?: string
}

export default function BroadcasterPage() {
    // --- State ---
    const [articles, setArticles] = useState<Article[]>([])
    const [loadingArticles, setLoadingArticles] = useState(true)

    // Selection
    const [selectedArticleId, setSelectedArticleId] = useState<string>('')
    const [manualMode, setManualMode] = useState(false)

    // Draft Content
    const [draftThread, setDraftThread] = useState<ThreadPost[]>([])
    const [isGenerating, setIsGenerating] = useState(false)

    // Publishing
    // Publishing
    const [accounts, setAccounts] = useState<any[]>([])
    const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([])
    const [isPosting, setIsPosting] = useState(false)
    const [postResult, setPostResult] = useState<{ success: boolean, message: string } | null>(null)

    // Manual Override
    const [showManual, setShowManual] = useState(false)
    const [creds, setCreds] = useState({ handle: '', password: '' })
    const [mastoCreds, setMastoCreds] = useState({ instanceUrl: '', accessToken: '' })

    // --- Effects ---
    useEffect(() => {
        fetchArticles()
        fetchAccounts()
        // Load creds from local storage if available (simulated persistence)
        const storedBsky = localStorage.getItem('bsky_creds')
        if (storedBsky) setCreds(JSON.parse(storedBsky))

        const storedMasto = localStorage.getItem('masto_creds')
        if (storedMasto) setMastoCreds(JSON.parse(storedMasto))
    }, [])


    const fetchAccounts = async () => {
        try {
            const res = await fetch('/api/settings/social-accounts')
            const data = await res.json()
            if (Array.isArray(data)) {
                setAccounts(data)
                // Select all by default
                setSelectedAccountIds(data.map(a => a.id))
            }
        } catch (e) {
            console.error('Failed to load accounts')
        }
    }

    const fetchArticles = async () => {
        try {
            const res = await fetch('/api/articles?drafts=false')
            const data = await res.json()
            setArticles(data.articles || [])
        } catch (e) {
            console.error('Failed to load articles', e)
        } finally {
            setLoadingArticles(false)
        }
    }

    // --- Actions ---

    const handleGenerateDraft = async () => {
        if (!selectedArticleId) return

        const article = articles.find(a => a.id.toString() === selectedArticleId)
        if (!article) return

        setIsGenerating(true)
        setDraftThread([])
        setPostResult(null)

        try {
            const res = await fetch('/api/broadcast/draft', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    headline: article.headline,
                    summary: article.summary,
                    url: `${window.location.origin}/articles/${article.slug}`
                })
            })
            const data = await res.json()

            if (!res.ok) throw new Error(data.error || 'Generation failed')

            setDraftThread(data.thread)
        } catch (e: any) {
            alert(e.message)
        } finally {
            setIsGenerating(false)
        }
    }

    const handlePost = async () => {
        const hasManual = (creds.handle && creds.password) || (mastoCreds.instanceUrl && mastoCreds.accessToken)
        const hasSelected = selectedAccountIds.length > 0

        if (!hasManual && !hasSelected) {
            alert('Please select an account or enter manual credentials.')
            return
        }
        if (draftThread.length === 0) return

        setIsPosting(true)
        setPostResult(null)

        // Save creds for convenience
        if (showManual && creds.handle && creds.password) localStorage.setItem('bsky_creds', JSON.stringify(creds))
        if (showManual && mastoCreds.instanceUrl) localStorage.setItem('masto_creds', JSON.stringify(mastoCreds))

        try {
            const res = await fetch('/api/broadcast/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    thread: draftThread,
                    accountIds: selectedAccountIds,
                    credentials: (showManual && creds.handle) ? creds : undefined,
                    mastodonCredentials: (showManual && mastoCreds.instanceUrl) ? mastoCreds : undefined
                })
            })
            const data = await res.json()

            if (res.ok) {
                const count = (data.results.accounts?.length || 0) + (data.results.bluesky?.posted ? 1 : 0) + (data.results.mastodon?.posted ? 1 : 0)
                setPostResult({ success: true, message: `Successfully broadcasted to ${count} destination(s).` })
            } else {
                setPostResult({ success: false, message: data.error || 'Failed to post' })
            }
        } catch (e: any) {
            setPostResult({ success: false, message: e.message })
        } finally {
            setIsPosting(false)
        }
    }

    const updatePostText = (index: number, text: string) => {
        const newThread = [...draftThread]
        newThread[index] = { ...newThread[index], text }
        setDraftThread(newThread)
    }

    const addPost = () => {
        setDraftThread([...draftThread, { text: '' }])
    }

    const removePost = (index: number) => {
        setDraftThread(draftThread.filter((_, i) => i !== index))
    }

    // --- Render ---

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-8">
            <header className="flex items-center justify-between border-b border-white/5 pb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Send className="w-6 h-6 text-blue-400" />
                        Broadcaster Console
                    </h1>
                    <p className="text-slate-400 mt-1">Distribute Unfiltered Intelligence to the social web.</p>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* LEFT COLUMN: SOURCE & CONFIG */}
                <div className="lg:col-span-5 space-y-6">

                    {/* Source Selector */}
                    <div className="glass-panel p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                Source Material
                            </h2>
                            {manualMode ? (
                                <button onClick={() => setManualMode(false)} className="text-xs text-blue-400 hover:text-blue-300">
                                    Switch to Article Selector
                                </button>
                            ) : (
                                <button onClick={() => setManualMode(true)} className="text-xs text-slate-500 hover:text-white">
                                    Switch to Manual Mode
                                </button>
                            )}
                        </div>

                        {!manualMode ? (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm text-slate-400 mb-2">Select Published Article</label>
                                    {loadingArticles ? (
                                        <div className="text-sm text-slate-500 flex items-center gap-2">
                                            <Loader2 className="w-3 h-3 animate-spin" /> Loading articles...
                                        </div>
                                    ) : (
                                        <select
                                            className="input w-full"
                                            value={selectedArticleId}
                                            onChange={(e) => setSelectedArticleId(e.target.value)}
                                        >
                                            <option value="">-- Choose an Article --</option>
                                            {articles.map(a => (
                                                <option key={a.id} value={a.id}>
                                                    {a.headline} ({new Date(a.publishedAt).toLocaleDateString()})
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>

                                <button
                                    onClick={handleGenerateDraft}
                                    disabled={!selectedArticleId || isGenerating}
                                    className="btn-primary w-full"
                                >
                                    {isGenerating ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Drafting...
                                        </>
                                    ) : (
                                        <>
                                            <Wand2 className="w-4 h-4 mr-2" />
                                            Generate Magic Thread
                                        </>
                                    )}
                                </button>
                            </div>
                        ) : (
                            <div className="p-8 text-center border border-dashed border-white/10 rounded-lg text-slate-500">
                                <Edit3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">Manual mode allows you to write a thread from scratch on the right.</p>
                                <button
                                    onClick={() => {
                                        setDraftThread([{ text: '' }, { text: '' }, { text: '' }])
                                    }}
                                    className="mt-4 btn-secondary text-xs"
                                >
                                    Start Blank Draft
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Destinations */}
                    <div className="glass-panel p-6 space-y-4">
                        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <Send className="w-4 h-4" />
                            Destinations
                        </h2>

                        <div className="space-y-3">
                            {accounts.length === 0 && (
                                <div className="text-sm text-slate-500 p-4 border border-dashed border-white/10 rounded-lg text-center">
                                    No accounts connected. <a href="/dashboard/settings" className="text-blue-400 underline">Go to Settings</a> to add one.
                                </div>
                            )}

                            {accounts.map(acc => (
                                <label key={acc.id} className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${selectedAccountIds.includes(acc.id)
                                    ? 'bg-blue-500/10 border-blue-500/30'
                                    : 'bg-white/5 border-white/5 hover:border-white/20'
                                    }`}>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            checked={selectedAccountIds.includes(acc.id)}
                                            onChange={(e) => {
                                                if (e.target.checked) setSelectedAccountIds([...selectedAccountIds, acc.id])
                                                else setSelectedAccountIds(selectedAccountIds.filter(id => id !== acc.id))
                                            }}
                                            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-offset-0 focus:ring-blue-500"
                                        />
                                        <span className={`w-2 h-2 rounded-full ${acc.platform === 'mastodon' ? 'bg-purple-500' : 'bg-blue-500'}`} />
                                        <div>
                                            <div className="font-medium text-white text-sm">{acc.handle}</div>
                                            <div className="text-xs text-slate-500 capitalize">{acc.platform}</div>
                                        </div>
                                    </div>
                                    <div className="text-xs text-slate-500">
                                        {acc.isActive ? 'Ready' : 'Inactive'}
                                    </div>
                                </label>
                            ))}
                        </div>

                        <div className="pt-4 border-t border-white/5">
                            <button
                                onClick={() => setShowManual(!showManual)}
                                className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                            >
                                {showManual ? '- Hide Manual Config' : '+ Show Manual Config'}
                            </button>
                        </div>

                        {showManual && (
                            <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-2">
                                {/* API Credentials - BLUESKY */}
                                <div className="p-4 bg-white/5 rounded-lg border border-white/5">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase mb-3">Bluesky Manual Override</h3>
                                    <div className="space-y-3">
                                        <input
                                            type="text"
                                            className="input text-sm w-full"
                                            placeholder="user.bsky.social"
                                            value={creds.handle}
                                            onChange={e => setCreds({ ...creds, handle: e.target.value })}
                                        />
                                        <input
                                            type="password"
                                            className="input text-sm w-full"
                                            placeholder="App Password"
                                            value={creds.password}
                                            onChange={e => setCreds({ ...creds, password: e.target.value })}
                                        />
                                    </div>
                                </div>

                                {/* API Credentials - MASTODON */}
                                <div className="p-4 bg-white/5 rounded-lg border border-white/5 border-purple-500/10">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase mb-3">Mastodon Manual Override</h3>
                                    <div className="space-y-3">
                                        <input
                                            type="text"
                                            className="input text-sm w-full"
                                            placeholder="https://mastodon.social"
                                            value={mastoCreds.instanceUrl}
                                            onChange={e => setMastoCreds({ ...mastoCreds, instanceUrl: e.target.value })}
                                        />
                                        <input
                                            type="password"
                                            className="input text-sm w-full"
                                            placeholder="Access Token"
                                            value={mastoCreds.accessToken}
                                            onChange={e => setMastoCreds({ ...mastoCreds, accessToken: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>


                    {/* RIGHT COLUMN: PREVIEW & ACTION */}
                    <div className="lg:col-span-7 space-y-6">

                        <div className="glass-panel min-h-[600px] flex flex-col relative border-blue-500/10">
                            {/* Header */}
                            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/20">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                                    <span className="text-sm font-bold text-slate-300">Thread Preview</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {draftThread.length > 0 && (
                                        <button onClick={addPost} className="text-xs btn-secondary py-1 px-2 h-auto">
                                            + Add Post
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Content Area */}
                            <div className="flex-1 p-6 space-y-6 overflow-y-auto max-h-[700px]">
                                {draftThread.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4 opacity-50">
                                        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                                            <Send className="w-8 h-8 text-slate-600" />
                                        </div>
                                        <p>Select an article or start manually to preview thread.</p>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        {/* Thread Connector Line */}
                                        <div className="absolute left-[27px] top-4 bottom-4 w-0.5 bg-white/10 z-0" />

                                        {draftThread.map((post, i) => (
                                            <div key={i} className="relative z-10 flex gap-4 mb-6 group">
                                                {/* Avatar Placeholder */}
                                                <div className="w-14 h-14 rounded-full bg-slate-800 border-4 border-[#0A0A0A] flex-shrink-0" />

                                                {/* Post Body */}
                                                <div className="flex-1">
                                                    <div className="bg-white/5 border border-white/5 rounded-xl p-4 transition-all focus-within:ring-1 ring-blue-500/50">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className="text-xs font-bold text-slate-400">Post {i + 1}</span>
                                                            <div className="text-xs text-slate-600 flex gap-2">
                                                                <span>{post.text.length} chars</span>
                                                                <button onClick={() => removePost(i)} className="text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity">Remove</button>
                                                            </div>
                                                        </div>
                                                        <textarea
                                                            value={post.text}
                                                            onChange={(e) => updatePostText(i, e.target.value)}
                                                            className="w-full bg-transparent border-none text-slate-200 text-base resize-none focus:ring-0 p-0 leading-relaxed font-sans"
                                                            rows={Math.max(3, Math.ceil(post.text.length / 50))}
                                                            placeholder="What's happening?"
                                                        />
                                                    </div>
                                                    {/* Image Placeholder (Future) */}
                                                    {post.image_prompt && (
                                                        <div className="mt-2 text-xs text-slate-500 flex items-center gap-2 px-2">
                                                            <Wand2 className="w-3 h-3" />
                                                            <span>Suggested Image: {post.image_prompt}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Footer Action */}
                            <div className="p-6 border-t border-white/5 bg-black/20 flex items-center justify-between">
                                <div className="text-sm">
                                    {postResult && (
                                        <span className={`flex items-center gap-2 ${postResult.success ? 'text-green-400' : 'text-red-400'}`}>
                                            {postResult.success ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                                            {postResult.message}
                                        </span>
                                    )}
                                </div>
                                <button
                                    onClick={handlePost}
                                    disabled={isPosting || draftThread.length === 0}
                                    className="btn-primary bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20 px-8 py-3 h-auto text-base"
                                >
                                    {isPosting ? (
                                        <>
                                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                            Publishing...
                                        </>
                                    ) : (
                                        <>
                                            <Send className="w-5 h-5 mr-2" />
                                            Broadcast Thread
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    )
}


