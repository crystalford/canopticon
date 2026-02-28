'use client'

import { useState, useEffect } from 'react'
import { Save, Plus, Key, Bot, Cpu, Edit2, Check, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

const X_KEY_FIELDS = ['TWITTER_API_KEY', 'TWITTER_API_SECRET', 'TWITTER_ACCESS_TOKEN', 'TWITTER_ACCESS_SECRET'] as const
type XKeyField = typeof X_KEY_FIELDS[number]

const BLUESKY_FIELDS = ['BLUESKY_HANDLE', 'BLUESKY_APP_PASSWORD'] as const
const TIKTOK_FIELDS = ['TIKTOK_ACCESS_TOKEN'] as const
const THREADS_FIELDS = ['THREADS_ACCESS_TOKEN', 'THREADS_USER_ID'] as const
type SocialField = typeof BLUESKY_FIELDS[number] | typeof TIKTOK_FIELDS[number] | typeof THREADS_FIELDS[number]

export default function SettingsPage() {
    const [settings, setSettings] = useState<Record<string, string>>({})
    // X keys are completely isolated — fetchData never touches these
    const [xKeys, setXKeys] = useState<Record<XKeyField, string>>({
        TWITTER_API_KEY: '',
        TWITTER_API_SECRET: '',
        TWITTER_ACCESS_TOKEN: '',
        TWITTER_ACCESS_SECRET: '',
    })
    const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set())
    const [agents, setAgents] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [savingLlm, setSavingLlm] = useState(false)
    const [savingX, setSavingX] = useState(false)
    const [socialKeys, setSocialKeys] = useState<Record<SocialField, string>>({
        BLUESKY_HANDLE: '', BLUESKY_APP_PASSWORD: '',
        TIKTOK_ACCESS_TOKEN: '',
        THREADS_ACCESS_TOKEN: '', THREADS_USER_ID: '',
    })
    const [savingSocial, setSavingSocial] = useState<Record<string, boolean>>({})
    const [socialStatus, setSocialStatus] = useState<Record<string, 'idle' | 'saved' | 'error'>>({})
    const [socialError, setSocialError] = useState<Record<string, string>>({})
    const [llmStatus, setLlmStatus] = useState<'idle' | 'saved' | 'error'>('idle')
    const [xStatus, setXStatus] = useState<'idle' | 'saved' | 'error' | 'empty'>('idle')
    const [xError, setXError] = useState('')
    const [testingX, setTestingX] = useState(false)
    const [xTestResult, setXTestResult] = useState<{ ok: boolean; message: string } | null>(null)
    const [editingAgent, setEditingAgent] = useState<any | null>(null)
    const [isNewAgent, setIsNewAgent] = useState(false)

    useEffect(() => { fetchData() }, [])

    const fetchData = async () => {
        setLoading(true)
        try {
            const [sRes, aRes] = await Promise.all([
                fetch('/api/settings'),
                fetch('/api/agents')
            ])
            // Only update settings state if the response is valid JSON success
            if (sRes.ok) {
                const s = await sRes.json() as Record<string, string>
                // Track which keys have saved values (masked = saved in DB)
                const saved = new Set<string>()
                for (const [k, v] of Object.entries(s)) {
                    if (v === '********') saved.add(k)
                }
                setSavedKeys(saved)
                // Only store non-X, non-masked settings in shared state
                const cleanSettings: Record<string, string> = {}
                for (const [k, v] of Object.entries(s)) {
                    if (!X_KEY_FIELDS.includes(k as XKeyField)) {
                        cleanSettings[k] = v === '********' ? '' : v
                    }
                }
                setSettings(cleanSettings)
            }
            if (aRes.ok) setAgents(await aRes.json())
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

            if (Object.keys(payload).length === 0) {
                setLlmStatus('error')
                setSavingLlm(false)
                return
            }

            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            if (!res.ok) throw new Error('Save failed')
            setLlmStatus('saved')
            await fetchData()
            setTimeout(() => setLlmStatus('idle'), 4000)
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
        setXError('')
        setXTestResult(null)
        try {
            // Read exclusively from isolated xKeys state — never from shared settings
            const payload: Record<string, string> = {}
            for (const key of X_KEY_FIELDS) {
                if (xKeys[key]?.trim()) payload[key] = xKeys[key].trim()
            }

            if (Object.keys(payload).length === 0) {
                // All keys already saved and user hasn't typed new values
                const allSaved = X_KEY_FIELDS.every(k => savedKeys.has(k))
                if (allSaved) {
                    setXError('All keys are already saved in the database. To update a key, type the new value in its field.')
                } else {
                    setXError('Enter at least one key to save.')
                }
                setXStatus('empty')
                setSavingX(false)
                return
            }

            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.error || `Server error (${res.status})`)
            }
            // Clear the typed values and refresh saved key indicators
            setXKeys({ TWITTER_API_KEY: '', TWITTER_API_SECRET: '', TWITTER_ACCESS_TOKEN: '', TWITTER_ACCESS_SECRET: '' })
            setXStatus('saved')
            await fetchData()
            setTimeout(() => setXStatus('idle'), 4000)
        } catch (err: any) {
            setXError(err.message || 'Save failed. Check the browser console for details.')
            setXStatus('error')
        } finally {
            setSavingX(false)
        }
    }

    const saveSocialSection = async (platform: string, fields: readonly SocialField[]) => {
        setSavingSocial(prev => ({ ...prev, [platform]: true }))
        setSocialStatus(prev => ({ ...prev, [platform]: 'idle' }))
        setSocialError(prev => ({ ...prev, [platform]: '' }))
        try {
            const payload: Record<string, string> = {}
            for (const key of fields) {
                if (socialKeys[key]?.trim()) payload[key] = socialKeys[key].trim()
            }
            if (Object.keys(payload).length === 0) {
                setSocialError(prev => ({ ...prev, [platform]: 'Enter at least one value to save.' }))
                setSocialStatus(prev => ({ ...prev, [platform]: 'error' }))
                return
            }
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.error || `Server error (${res.status})`)
            }
            const cleared = { ...socialKeys }
            for (const key of fields) cleared[key] = ''
            setSocialKeys(cleared)
            setSocialStatus(prev => ({ ...prev, [platform]: 'saved' }))
            await fetchData()
            setTimeout(() => setSocialStatus(prev => ({ ...prev, [platform]: 'idle' })), 4000)
        } catch (err: any) {
            setSocialError(prev => ({ ...prev, [platform]: err.message || 'Save failed' }))
            setSocialStatus(prev => ({ ...prev, [platform]: 'error' }))
        } finally {
            setSavingSocial(prev => ({ ...prev, [platform]: false }))
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
                        <div className="p-2 bg-sky-500/10 rounded-lg text-sky-400 text-base font-bold w-9 h-9 flex items-center justify-center">𝕏</div>
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
                        { key: 'TWITTER_API_KEY' as XKeyField, label: 'API Key (Consumer Key)' },
                        { key: 'TWITTER_API_SECRET' as XKeyField, label: 'API Secret (Consumer Secret)' },
                        { key: 'TWITTER_ACCESS_TOKEN' as XKeyField, label: 'Access Token' },
                        { key: 'TWITTER_ACCESS_SECRET' as XKeyField, label: 'Access Token Secret' },
                    ]).map(({ key, label }) => (
                        <div key={key}>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-medium text-slate-400 uppercase">{label}</label>
                                {savedKeys.has(key)
                                    ? <span className="text-[10px] text-green-400 flex items-center gap-1"><CheckCircle size={10} /> Saved in DB</span>
                                    : <span className="text-[10px] text-amber-400">Not saved</span>
                                }
                            </div>
                            <input
                                type="text"
                                autoComplete="off"
                                value={xKeys[key]}
                                onChange={e => { const v = e.target.value; setXKeys(prev => ({ ...prev, [key]: v })) }}
                                placeholder={savedKeys.has(key) ? 'Leave blank to keep current — type to update' : 'Paste key here...'}
                                className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:border-sky-500/50 outline-none transition-colors font-mono text-sm"
                            />
                        </div>
                    ))}
                    <div className="pt-2 flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                            <button
                                type="submit"
                                disabled={savingX}
                                className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                            >
                                {savingX ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                {savingX ? 'Saving...' : 'Save X Credentials'}
                            </button>
                            {xStatus === 'saved' && <span className="text-green-400 text-sm flex items-center gap-1"><Check size={14} /> Saved successfully</span>}
                        </div>
                        {(xStatus === 'error' || xStatus === 'empty') && xError && (
                            <div className="flex items-start gap-2 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                                <span>{xError}</span>
                            </div>
                        )}
                    </div>
                </form>
            </section>

            {/* Bluesky Credentials */}
            <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400 text-base font-bold w-9 h-9 flex items-center justify-center">B</div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-semibold text-white">Bluesky Credentials</h2>
                            {BLUESKY_FIELDS.every(k => savedKeys.has(k)) && (
                                <span className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-full px-2 py-0.5">Saved</span>
                            )}
                        </div>
                        <p className="text-sm text-slate-400">Your handle (e.g. you.bsky.social) + an App Password from Bluesky Settings.</p>
                    </div>
                </div>
                <div className="space-y-3 max-w-xl">
                    {([
                        { key: 'BLUESKY_HANDLE' as SocialField, label: 'Handle', placeholder: 'you.bsky.social', secret: false },
                        { key: 'BLUESKY_APP_PASSWORD' as SocialField, label: 'App Password', placeholder: 'xxxx-xxxx-xxxx-xxxx', secret: true },
                    ]).map(({ key, label, placeholder, secret }) => (
                        <div key={key}>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-medium text-slate-400 uppercase">{label}</label>
                                {savedKeys.has(key)
                                    ? <span className="text-[10px] text-green-400 flex items-center gap-1"><CheckCircle size={10} /> Saved in DB</span>
                                    : <span className="text-[10px] text-amber-400">Not saved</span>}
                            </div>
                            <input type={secret ? 'password' : 'text'} autoComplete="off"
                                value={socialKeys[key]}
                                onChange={e => { const v = e.target.value; setSocialKeys(prev => ({ ...prev, [key]: v })) }}
                                placeholder={savedKeys.has(key) ? 'Leave blank to keep current' : placeholder}
                                className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:border-blue-500/50 outline-none transition-colors font-mono text-sm" />
                        </div>
                    ))}
                    <div className="pt-1 flex items-center gap-3">
                        <button onClick={() => saveSocialSection('bluesky', BLUESKY_FIELDS)} disabled={!!savingSocial['bluesky']}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50">
                            {savingSocial['bluesky'] ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            {savingSocial['bluesky'] ? 'Saving...' : 'Save Bluesky'}
                        </button>
                        {socialStatus['bluesky'] === 'saved' && <span className="text-green-400 text-sm flex items-center gap-1"><Check size={14} /> Saved</span>}
                        {socialStatus['bluesky'] === 'error' && socialError['bluesky'] && (
                            <span className="text-red-400 text-sm flex items-center gap-1"><AlertCircle size={14} /> {socialError['bluesky']}</span>
                        )}
                    </div>
                </div>
            </section>

            {/* TikTok Credentials */}
            <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-pink-500/10 rounded-lg text-pink-400 text-xs font-bold w-9 h-9 flex items-center justify-center">TT</div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-semibold text-white">TikTok Credentials</h2>
                            {TIKTOK_FIELDS.every(k => savedKeys.has(k)) && (
                                <span className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-full px-2 py-0.5">Saved</span>
                            )}
                        </div>
                        <p className="text-sm text-slate-400">Access token from <a href="https://developers.tiktok.com" target="_blank" rel="noopener noreferrer" className="text-pink-400 hover:underline">TikTok for Developers</a>. Requires approved app.</p>
                    </div>
                </div>
                <div className="space-y-3 max-w-xl">
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-medium text-slate-400 uppercase">Access Token</label>
                            {savedKeys.has('TIKTOK_ACCESS_TOKEN')
                                ? <span className="text-[10px] text-green-400 flex items-center gap-1"><CheckCircle size={10} /> Saved in DB</span>
                                : <span className="text-[10px] text-amber-400">Not saved</span>}
                        </div>
                        <input type="password" autoComplete="off"
                            value={socialKeys['TIKTOK_ACCESS_TOKEN']}
                            onChange={e => { const v = e.target.value; setSocialKeys(prev => ({ ...prev, TIKTOK_ACCESS_TOKEN: v })) }}
                            placeholder={savedKeys.has('TIKTOK_ACCESS_TOKEN') ? 'Leave blank to keep current' : 'Paste access token...'}
                            className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:border-pink-500/50 outline-none transition-colors font-mono text-sm" />
                    </div>
                    <div className="pt-1 flex items-center gap-3">
                        <button onClick={() => saveSocialSection('tiktok', TIKTOK_FIELDS)} disabled={!!savingSocial['tiktok']}
                            className="flex items-center gap-2 px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50">
                            {savingSocial['tiktok'] ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            {savingSocial['tiktok'] ? 'Saving...' : 'Save TikTok'}
                        </button>
                        {socialStatus['tiktok'] === 'saved' && <span className="text-green-400 text-sm flex items-center gap-1"><Check size={14} /> Saved</span>}
                        {socialStatus['tiktok'] === 'error' && socialError['tiktok'] && (
                            <span className="text-red-400 text-sm flex items-center gap-1"><AlertCircle size={14} /> {socialError['tiktok']}</span>
                        )}
                    </div>
                </div>
            </section>

            {/* Threads Credentials */}
            <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400 text-xs font-bold w-9 h-9 flex items-center justify-center">@</div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-semibold text-white">Threads Credentials</h2>
                            {THREADS_FIELDS.every(k => savedKeys.has(k)) && (
                                <span className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-full px-2 py-0.5">Saved</span>
                            )}
                        </div>
                        <p className="text-sm text-slate-400">Access token + User ID from <a href="https://developers.facebook.com/docs/threads" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">Meta Threads API</a>.</p>
                    </div>
                </div>
                <div className="space-y-3 max-w-xl">
                    {([
                        { key: 'THREADS_ACCESS_TOKEN' as SocialField, label: 'Access Token', placeholder: 'Paste access token...' },
                        { key: 'THREADS_USER_ID' as SocialField, label: 'User ID', placeholder: 'Your numeric Threads user ID' },
                    ]).map(({ key, label, placeholder }) => (
                        <div key={key}>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-medium text-slate-400 uppercase">{label}</label>
                                {savedKeys.has(key)
                                    ? <span className="text-[10px] text-green-400 flex items-center gap-1"><CheckCircle size={10} /> Saved in DB</span>
                                    : <span className="text-[10px] text-amber-400">Not saved</span>}
                            </div>
                            <input type="password" autoComplete="off"
                                value={socialKeys[key]}
                                onChange={e => { const v = e.target.value; setSocialKeys(prev => ({ ...prev, [key]: v })) }}
                                placeholder={savedKeys.has(key) ? 'Leave blank to keep current' : placeholder}
                                className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:border-purple-500/50 outline-none transition-colors font-mono text-sm" />
                        </div>
                    ))}
                    <div className="pt-1 flex items-center gap-3">
                        <button onClick={() => saveSocialSection('threads', THREADS_FIELDS)} disabled={!!savingSocial['threads']}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50">
                            {savingSocial['threads'] ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            {savingSocial['threads'] ? 'Saving...' : 'Save Threads'}
                        </button>
                        {socialStatus['threads'] === 'saved' && <span className="text-green-400 text-sm flex items-center gap-1"><Check size={14} /> Saved</span>}
                        {socialStatus['threads'] === 'error' && socialError['threads'] && (
                            <span className="text-red-400 text-sm flex items-center gap-1"><AlertCircle size={14} /> {socialError['threads']}</span>
                        )}
                    </div>
                </div>
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
