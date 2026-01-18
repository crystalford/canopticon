'use client'

import { useState, useEffect } from 'react'
import { Key, CheckCircle, XCircle, Share2, Trash2, Plus, AlertCircle } from 'lucide-react'


export default function SettingsPage() {
    const [provider, setProvider] = useState('openai')
    const [status, setStatus] = useState({ openai: false, anthropic: false, grok: false, gemini: false })
    const [inputs, setInputs] = useState({ openai_key: '', anthropic_key: '', grok_key: '', gemini_key: '', video_webhook_url: '' })
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

    // Social Accounts State
    const [socialAccounts, setSocialAccounts] = useState<any[]>([])
    const [addingAccount, setAddingAccount] = useState(false)
    const [newAccountPlatform, setNewAccountPlatform] = useState('bluesky')
    const [newAccountCreds, setNewAccountCreds] = useState<any>({})

    useEffect(() => {
        fetchSettings()
        fetchSocialAccounts()
    }, [])

    const fetchSocialAccounts = async () => {
        try {
            const res = await fetch('/api/settings/social-accounts')
            const data = await res.json()
            setSocialAccounts(Array.isArray(data) ? data : [])
        } catch (e) {
            console.error('Failed to load social accounts')
        }
    }

    const fetchSettings = async () => {
        try {
            const res = await fetch('/api/settings')
            const data = await res.json()
            setProvider(data.provider)
            setStatus(data.status)
        } catch (error) {
            console.error('Failed to load settings')
        } finally {
            setLoading(false)
        }
    }

    const handleAddAccount = async (e: React.FormEvent) => {
        e.preventDefault()
        setAddingAccount(true)
        try {
            const res = await fetch('/api/settings/social-accounts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    platform: newAccountPlatform,
                    credentials: newAccountCreds
                })
            })
            const data = await res.json()
            if (res.ok) {
                setMessage({ type: 'success', text: 'Account connected successfully' })
                setNewAccountCreds({})
                fetchSocialAccounts()
            } else {
                setMessage({ type: 'error', text: data.error || 'Failed to connect account' })
            }
        } catch (e) {
            setMessage({ type: 'error', text: 'Error connecting account' })
        } finally {
            setAddingAccount(false)
        }
    }

    const handleDeleteAccount = async (id: string) => {
        if (!confirm('Are you sure you want to disconnect this account?')) return
        try {
            await fetch(`/api/settings/social-accounts/${id}`, { method: 'DELETE' })
            setMessage({ type: 'success', text: 'Account disconnected' })
            fetchSocialAccounts()
        } catch (e) {
            setMessage({ type: 'error', text: 'Failed to disconnect account' })
        }
    }


    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        setMessage(null)

        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    provider,
                    openai_key: inputs.openai_key || undefined,
                    anthropic_key: inputs.anthropic_key || undefined,
                    grok_key: inputs.grok_key || undefined,
                    gemini_key: inputs.gemini_key || undefined,
                })
            })

            if (res.ok) {
                setMessage({ type: 'success', text: 'Settings saved successfully' })
                setInputs({ openai_key: '', anthropic_key: '', grok_key: '', gemini_key: '', video_webhook_url: '' })
                fetchSettings()
            } else {
                setMessage({ type: 'error', text: 'Failed to save settings' })
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Error saving settings' })
        } finally {
            setSaving(false)
        }
    }

    if (loading) return <div className="p-8 text-center text-slate-400">Loading settings...</div>

    return (
        <div className="space-y-8 max-w-4xl">
            <div className="pb-6 border-b border-white/5">
                <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">System Settings</h1>
                <p className="text-slate-400 text-sm">Configure AI providers and system parameters.</p>
            </div>

            <form onSubmit={handleSave} className="space-y-8">

                {/* Social Accounts */}
                <div className="glass-panel p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Share2 className="w-5 h-5 text-primary-400" />
                        Connected Accounts
                    </h3>

                    {/* List */}
                    <div className="space-y-3 mb-6">
                        {socialAccounts.length === 0 && (
                            <div className="text-sm text-slate-500 italic p-4 border border-dashed border-white/10 rounded-lg text-center">
                                No social accounts connected. Add one below to enable broadcasting.
                            </div>
                        )}
                        {socialAccounts.map(acc => (
                            <div key={acc.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
                                <div className="flex items-center gap-3">
                                    <div className={`w-2 h-2 rounded-full ${acc.platform === 'mastodon' ? 'bg-purple-500' : 'bg-blue-500'}`} />
                                    <div>
                                        <div className="font-medium text-white text-sm">{acc.handle}</div>
                                        <div className="text-xs text-slate-500 capitalize">{acc.platform} {acc.instanceUrl ? `(${acc.instanceUrl})` : ''}</div>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleDeleteAccount(acc.id)}
                                    className="p-2 hover:bg-red-500/10 hover:text-red-400 text-slate-500 rounded transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Add New */}
                    <div className="p-4 bg-white/5 rounded-lg border border-white/5">
                        <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                            <Plus className="w-4 h-4" /> Connect New Account
                        </h4>

                        <div className="flex gap-4 mb-4">
                            {['bluesky', 'mastodon'].map(p => (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => setNewAccountPlatform(p)}
                                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${newAccountPlatform === p
                                        ? (p === 'mastodon' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30')
                                        : 'bg-white/5 text-slate-400 hover:bg-white/10'
                                        }`}
                                >
                                    {p === 'bluesky' ? 'Bluesky' : 'Mastodon'}
                                </button>
                            ))}
                        </div>

                        <div className="space-y-3">
                            {newAccountPlatform === 'bluesky' ? (
                                <>
                                    <input
                                        type="text"
                                        placeholder="Handle (e.g. user.bsky.social)"
                                        value={newAccountCreds.handle || ''}
                                        onChange={e => setNewAccountCreds({ ...newAccountCreds, handle: e.target.value })}
                                        className="input w-full text-sm"
                                    />
                                    <input
                                        type="password"
                                        placeholder="App Password (not login password)"
                                        value={newAccountCreds.password || ''}
                                        onChange={e => setNewAccountCreds({ ...newAccountCreds, password: e.target.value })}
                                        className="input w-full text-sm"
                                    />
                                    <p className="text-xs text-slate-500">
                                        Use an App Password from Settings {'>'} App Passwords in Bluesky.
                                    </p>
                                </>
                            ) : (
                                <>
                                    <input
                                        type="text"
                                        placeholder="Instance URL (e.g. https://mastodon.social)"
                                        value={newAccountCreds.instanceUrl || ''}
                                        onChange={e => setNewAccountCreds({ ...newAccountCreds, instanceUrl: e.target.value })}
                                        className="input w-full text-sm"
                                    />
                                    <input
                                        type="password"
                                        placeholder="Access Token"
                                        value={newAccountCreds.accessToken || ''}
                                        onChange={e => setNewAccountCreds({ ...newAccountCreds, accessToken: e.target.value })}
                                        className="input w-full text-sm"
                                    />
                                    <p className="text-xs text-slate-500">
                                        Get an access token from Preferences {'>'} Development in Mastodon.
                                    </p>
                                </>
                            )}

                            <button
                                type="button"
                                onClick={handleAddAccount}
                                disabled={addingAccount}
                                className="w-full btn-secondary text-xs py-2 mt-2"
                            >
                                {addingAccount ? 'Connecting...' : 'Connect Account'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Provider Selection (Existing) */}

                <div className="glass-panel p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">AI Provider</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                            { value: 'openai', name: 'OpenAI', desc: 'GPT-4o, GPT-4o-mini' },
                            { value: 'anthropic', name: 'Anthropic', desc: 'Claude 3.5 Sonnet' },
                            { value: 'grok', name: 'xAI (Grok)', desc: 'Grok Beta' },
                            { value: 'gemini', name: 'Google Gemini', desc: 'Gemini 2.5 Flash (FREE)' },
                        ].map(p => (
                            <label key={p.value} className={`
                                cursor-pointer p-4 rounded-lg border-2 transition-all block
                                ${provider === p.value
                                    ? 'border-primary-500 bg-primary-500/10'
                                    : 'border-white/10 hover:border-white/20'}
                            `}>
                                <input
                                    type="radio"
                                    name="provider"
                                    value={p.value}
                                    checked={provider === p.value}
                                    onChange={(e) => setProvider(e.target.value)}
                                    className="sr-only"
                                />
                                <div className="font-medium text-white">{p.name}</div>
                                <div className="text-sm text-slate-400">{p.desc}</div>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Integrations */}
                <div className="glass-panel p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Share2 className="w-5 h-5 text-primary-400" />
                        Integrations
                    </h3>
                    <p className="text-sm text-slate-400 mb-6">
                        Connect with external automation tools like Make.com or Zapier.
                    </p>

                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium text-slate-300 mb-2 block">Video Webhook URL</label>
                            <input
                                type="text"
                                value={inputs.video_webhook_url || ''}
                                onChange={(e) => setInputs({ ...inputs, video_webhook_url: e.target.value })}
                                placeholder="https://hook.make.com/..."
                                className="input w-full text-sm"
                            />
                            <p className="text-xs text-slate-500 mt-2">
                                We will POST the raw video file to this URL when you click "Dispatch" in the Video Library.
                            </p>
                        </div>
                    </div>
                </div>

                {/* API Keys */}
                <div className="glass-panel p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Key className="w-5 h-5 text-primary-400" />
                        API Keys
                    </h3>
                    <p className="text-sm text-slate-400 mb-6">
                        Enter API keys for the providers you wish to use. Keys are encrypted at rest. Leave blank to keep existing keys.
                    </p>

                    <div className="space-y-4">
                        {[
                            { key: 'openai_key', label: 'OpenAI API Key', status: status.openai },
                            { key: 'anthropic_key', label: 'Anthropic API Key', status: status.anthropic },
                            { key: 'grok_key', label: 'xAI API Key', status: status.grok },
                            { key: 'gemini_key', label: 'Gemini API Key', status: status.gemini },
                        ].map(field => (
                            <div key={field.key}>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm font-medium text-slate-300">{field.label}</label>
                                    {field.status ? (
                                        <span className="flex items-center gap-1 text-xs text-green-400">
                                            <CheckCircle className="w-3 h-3" /> Configured
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1 text-xs text-slate-500">
                                            <XCircle className="w-3 h-3" /> Not Set
                                        </span>
                                    )}
                                </div>
                                <input
                                    type="password"
                                    value={inputs[field.key as keyof typeof inputs]}
                                    onChange={(e) => setInputs({ ...inputs, [field.key]: e.target.value })}
                                    placeholder="sk-..."
                                    className="input w-full font-mono text-sm"
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Save Button */}
                <div className="flex items-center justify-between">
                    {message && (
                        <div className={`px-4 py-2 rounded-lg text-sm ${message.type === 'success'
                            ? 'bg-green-500/10 text-green-300 border border-green-500/20'
                            : 'bg-red-500/10 text-red-300 border border-red-500/20'
                            }`}>
                            {message.text}
                        </div>
                    )}
                    <button type="submit" disabled={saving} className="btn-primary ml-auto">
                        {saving ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            </form>
        </div>
    )
}
