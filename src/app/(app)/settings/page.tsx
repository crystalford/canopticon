'use client'

import { useState, useEffect } from 'react'
import { Save, Plus, Key, Bot, Cpu, Edit2, Check, X, Twitter, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

export default function SettingsPage() {
    const [settings, setSettings] = useState<Record<string, string>>({})
    const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set())
    const [agents, setAgents] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [savingLlm, setSavingLlm] = useState(false)
    const [savingX, setSavingX] = useState(false)
    const [llmStatus, setLlmStatus] = useState<'idle' | 'saved' | 'error'>('idle')
    const [xStatus, setXStatus] = useState<'idle' | 'saved' | 'error'>('idle')
    const [testingX, setTestingX] = useState(false)
    const [xTestResult, setXTestResult] = useState<{ ok: boolean; message: string } | null>(null)
    const [editingAgent, setEditingAgent] = useState<any | null>(null)
    const [isNewAgent, setIsNewAgent] = useState(false)

    useEffect(() => { fetchData() }, [])

    const fetchData = async () => {
        setLoading(true)
        try {
            const [s, a] = await Promise.all([
                fetch('/api/settings').then(res => res.json()),
                fetch('/api/agents').then(res => res.json())
            ])
            // Track which keys have saved values (masked = saved in DB)
            const saved = new Set<string>()
            for (const [k, v] of Object.entries(s as Record<string, string>)) {
                if (v === '********') saved.add(k)
            }
            setSavedKeys(saved)
            // Don't put masked values into the form — clear them so user types fresh
            const cleanSettings: Record<string, string> = {}
            for (const [k, v] of Object.entries(s as Record<string, string>)) {
                cleanSettings[k] = v === '********' ? '' : v as string
            }
            setSettings(cleanSettings)
            setAgents(a)
        } catch (error) {
            console.error('Failed to load settings', error)
        } finally {
            setLoading(false)
        }
    }

    const saveLlmKeys = async (e: React.FormEvent) => {
        e.preventDefault()
        setSavingLlm(true)
        setLlmStatus('idle')
        try {
            const payload: Record<string, string> = {}
            if (settings.OPENAI_API_KEY?.trim()) payload.OPENAI_API_KEY = settings.OPENAI_API_KEY.trim()
            if (settings.PERPLEXITY_API_KEY?.trim()) payload.PERPLEXITY_API_KEY = settings.PERPLEXITY_API_KEY.trim()

            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            if (!res.ok) throw new Error('Save failed')
            setLlmStatus('saved')
            await fetchData()
            setTimeout(() => setLlmStatus('idle'), 3000)
        } catch {
            setLlmStatus('error')
        } finally {
            setSavingLlm(false)
        }
    }

    const saveXKeys = async (e: React.FormEvent) => {
        e.preventDefault()
        setSavingX(true)
        setXStatus('idle')
        setXTestResult(null)
        try {
            const payload: Record<string, string> = {}
            if (settings.TWITTER_API_KEY?.trim()) payload.TWITTER_API_KEY = settings.TWITTER_API_KEY.trim()
            if (settings.TWITTER_API_SECRET?.trim()) payload.TWITTER_API_SECRET = settings.TWITTER_API_SECRET.trim()
            if (settings.TWITTER_ACCESS_TOKEN?.trim()) payload.TWITTER_ACCESS_TOKEN = settings.TWITTER_ACCESS_TOKEN.trim()
            if (settings.TWITTER_ACCESS_SECRET?.trim()) payload.TWITTER_ACCESS_SECRET = settings.TWITTER_ACCESS_SECRET.trim()

            if (Object.keys(payload).length === 0) {
                setXStatus('error')
                setSavingX(false)
                return
            }

            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            if (!res.ok) throw new Error('Save failed')
            setXStatus('saved')
            await fetchData()
            setTimeout(() => setXStatus('idle'), 3000)
        } catch {
            setXStatus('error')
        } finally {
            setSavingX(false)
        }
    }

    const testXCredentials = async () => {
        setTestingX(true)
        setXTestResult(null)
        try {
            const res = await fetch('/api/settings/test-x', { method: 'POST' })
            const data = await res.json()
            setXTestResult({ ok: res.ok && data.ok, message: data.message || data.error || 'Unknown result' })
        } catch (e: any) {
            setXTestResult({ ok: false, message: e.message })
        } finally {
            setTestingX(false)
        }
    }

    const saveAgent = async (agent: any) => {
        try {
            const res = await fetch('/api/agents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(agent)
            })
            if (!res.ok) throw new Error('Failed to save')
            await fetchData()
            setEditingAgent(null)
            setIsNewAgent(false)
        } catch {
            alert('Failed to save agent')
        }
    }

    if (loading) return <div className="p-10 text-center text-slate-500">Loading configuration...</div>

    const xKeysSaved = ['TWITTER_API_KEY', 'TWITTER_API_SECRET', 'TWITTER_ACCESS_TOKEN', 'TWITTER_ACCESS_SECRET'].every(k => savedKeys.has(k))

    return (
        <div className="max-w-5xl mx-auto p-8 space-y-12">
            <div>
                <h1 className="text-2xl font-bold text-white mb-2">System Settings</h1>
                <p className="text-slate-400">Configure API keys and manage AI agents. Keys stored in DB override Vercel environment variables.</p>
            </div>

            {/* LLM API Keys */}
            <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400"><Key size={20} /></div>
                    <div>
                        <h2 className="text-lg font-semibold text-white">LLM API Keys</h2>
                        <p className="text-sm text-slate-400">Leave blank to keep existing saved value. Only fill in to update.</p>
                    </div>
                </div>
                <form onSubmit={saveLlmKeys} className="space-y-4 max-w-xl">
                    {([
                        { key: 'OPENAI_API_KEY', label: 'OpenAI API Key', placeholder: 'sk-...' },
                        { key: 'PERPLEXITY_API_KEY', label: 'Perplexity API Key', placeholder: 'pplx-...' },
                    ] as { key: string; label: string; placeholder: string }[]).map(({ key, label, placeholder }) => (
                        <div key={key}>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-medium text-slate-400 uppercase">{label}</label>
                                {savedKeys.has(key) && (
                                    <span className="text-[10px] text-green-400 flex items-center gap-1">
                                        <CheckCircle size={10} /> Saved in DB
                                    </span>
                                )}
                            </div>
                            <input
                                type="password"
                                value={settings[key] || ''}
                                onChange={e => { const v = e.target.value; setSettings(prev => ({ ...prev, [key]: v })) }}
                                placeholder={savedKeys.has(key) ? '(leave blank to keep current)' : placeholder}
                                className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:border-purple-500/50 outline-none transition-colors"
                            />
                        </div>
                    ))}
                    <div className="pt-2 flex items-center gap-3">
                        <button
                            type="submit"
                            disabled={savingLlm}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                            {savingLlm ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            {savingLlm ? 'Saving...' : 'Save LLM Keys'}
                        </button>
                        {llmStatus === 'saved' && <span className="text-green-400 text-sm flex items-center gap-1"><Check size={14} /> Saved</span>}
                        {llmStatus === 'error' && <span className="text-red-400 text-sm flex items-center gap-1"><AlertCircle size={14} /> Failed to save</span>}
                    </div>
                </form>
            </section>

            {/* X / Twitter Credentials */}
            <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-sky-500/10 rounded-lg text-sky-400"><Twitter size={20} /></div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-semibold text-white">X / Twitter Credentials</h2>
                                {xKeysSaved && <span className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-full px-2 py-0.5">All 4 keys saved</span>}
                            </div>
                            <p className="text-sm text-slate-400">Leave blank to keep existing value. Only fill in to update a key.</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={testXCredentials}
                        disabled={testingX || !xKeysSaved}
                        title={!xKeysSaved ? 'Save all 4 X credentials first' : 'Test X connection'}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 rounded-lg text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {testingX ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                        Test Connection
                    </button>
                </div>

                {xTestResult && (
                    <div className={`mb-4 p-3 rounded-lg text-sm flex items-start gap-2 ${xTestResult.ok ? 'bg-green-500/10 text-green-300 border border-green-500/20' : 'bg-red-500/10 text-red-300 border border-red-500/20'}`}>
                        {xTestResult.ok ? <CheckCircle size={14} className="mt-0.5 shrink-0" /> : <AlertCircle size={14} className="mt-0.5 shrink-0" />}
                        {xTestResult.message}
                    </div>
                )}

                <form onSubmit={saveXKeys} className="space-y-4 max-w-xl">
                    {([
                        { key: 'TWITTER_API_KEY', label: 'API Key (Consumer Key)' },
                        { key: 'TWITTER_API_SECRET', label: 'API Secret (Consumer Secret)' },
                        { key: 'TWITTER_ACCESS_TOKEN', label: 'Access Token' },
                        { key: 'TWITTER_ACCESS_SECRET', label: 'Access Token Secret' },
                    ] as { key: string; label: string }[]).map(({ key, label }) => (
                        <div key={key}>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-medium text-slate-400 uppercase">{label}</label>
                                {savedKeys.has(key)
                                    ? <span className="text-[10px] text-green-400 flex items-center gap-1"><CheckCircle size={10} /> Saved</span>
                                    : <span className="text-[10px] text-amber-400">Not saved</span>
                                }
                            </div>
                            <input
                                type="password"
                                value={settings[key] || ''}
                                onChange={e => { const v = e.target.value; setSettings(prev => ({ ...prev, [key]: v })) }}
                                placeholder={savedKeys.has(key) ? '(leave blank to keep current)' : 'Paste key here...'}
                                className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:border-sky-500/50 outline-none transition-colors"
                            />
                        </div>
                    ))}
                    <div className="pt-2 flex items-center gap-3">
                        <button
                            type="submit"
                            disabled={savingX}
                            className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                            {savingX ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            {savingX ? 'Saving...' : 'Save X Credentials'}
                        </button>
                        {xStatus === 'saved' && <span className="text-green-400 text-sm flex items-center gap-1"><Check size={14} /> Saved</span>}
                        {xStatus === 'error' && <span className="text-red-400 text-sm flex items-center gap-1"><AlertCircle size={14} /> Nothing to save — enter at least one key</span>}
                    </div>
                </form>
            </section>

            {/* Agents */}
            <section>
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400"><Bot size={20} /></div>
                        <div>
                            <h2 className="text-lg font-semibold text-white">Active Agents</h2>
                            <p className="text-sm text-slate-400">Manage the personas available in chat.</p>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            setEditingAgent({ name: '', systemPrompt: '', modelProvider: 'openai', isActive: true })
                            setIsNewAgent(true)
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-600/20 rounded-lg text-sm font-medium transition-colors"
                    >
                        <Plus size={16} /> New Agent
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {agents.map(agent => (
                        <div key={agent.id} className="group bg-white/5 border border-white/10 hover:border-white/20 rounded-xl p-5 transition-all">
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="font-semibold text-white">{agent.name}</div>
                                    <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded border ${agent.isActive ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-slate-500/10 border-slate-500/20 text-slate-500'}`}>
                                        {agent.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                                <button
                                    onClick={() => { setEditingAgent(agent); setIsNewAgent(false) }}
                                    className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                                >
                                    <Edit2 size={14} />
                                </button>
                            </div>
                            <p className="text-sm text-slate-400 mb-4 h-10 line-clamp-2">{agent.description || 'No description provided.'}</p>
                            <div className="flex items-center gap-2 text-xs text-slate-500 bg-black/20 p-2 rounded">
                                <Cpu size={12} />
                                <span>{agent.modelProvider} / {agent.modelId || 'default'}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Agent Editor Modal */}
            {editingAgent && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center">
                            <h3 className="text-lg font-semibold text-white">{isNewAgent ? 'Create New Agent' : 'Edit Agent'}</h3>
                            <button onClick={() => setEditingAgent(null)} className="text-slate-400 hover:text-white"><X size={20} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 uppercase mb-1">Name</label>
                                    <input
                                        type="text"
                                        value={editingAgent.name}
                                        onChange={e => setEditingAgent({ ...editingAgent, name: e.target.value })}
                                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-blue-500/50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 uppercase mb-1">Provider</label>
                                    <select
                                        value={editingAgent.modelProvider}
                                        onChange={e => setEditingAgent({ ...editingAgent, modelProvider: e.target.value })}
                                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-blue-500/50 appearance-none cursor-pointer"
                                    >
                                        <option value="openai">OpenAI (GPT-4)</option>
                                        <option value="anthropic">Anthropic (Claude)</option>
                                        <option value="perplexity">Perplexity (Sonar)</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 uppercase mb-1">Description</label>
                                <input
                                    type="text"
                                    value={editingAgent.description || ''}
                                    onChange={e => setEditingAgent({ ...editingAgent, description: e.target.value })}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-blue-500/50"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 uppercase mb-1">System Prompt</label>
                                <textarea
                                    value={editingAgent.systemPrompt}
                                    onChange={e => setEditingAgent({ ...editingAgent, systemPrompt: e.target.value })}
                                    className="w-full h-64 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-sm outline-none focus:border-blue-500/50 resize-none"
                                    placeholder="You are a helpful assistant..."
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={editingAgent.isActive !== false}
                                    onChange={e => setEditingAgent({ ...editingAgent, isActive: e.target.checked })}
                                    id="isActive"
                                    className="rounded bg-black/20 border-white/10"
                                />
                                <label htmlFor="isActive" className="text-sm text-slate-300">Agent Enabled</label>
                            </div>
                        </div>
                        <div className="p-6 border-t border-white/10 bg-black/20 flex justify-end gap-3">
                            <button onClick={() => setEditingAgent(null)} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">Cancel</button>
                            <button
                                onClick={() => saveAgent(editingAgent)}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
                            >
                                {isNewAgent ? 'Create Agent' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
