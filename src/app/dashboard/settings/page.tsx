
'use client'

import { useState, useEffect } from 'react'

export default function SettingsPage() {
    const [provider, setProvider] = useState('openai')
    const [status, setStatus] = useState({ openai: false, anthropic: false, grok: false, gemini: false })
    const [inputs, setInputs] = useState({ openai_key: '', anthropic_key: '', grok_key: '', gemini_key: '' })
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

    useEffect(() => {
        fetchSettings()
    }, [])

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
                    openai_key: inputs.openai_key || undefined, // Only send if changed
                    anthropic_key: inputs.anthropic_key || undefined,
                    grok_key: inputs.grok_key || undefined,
                    gemini_key: inputs.gemini_key || undefined,
                })
            })

            if (res.ok) {
                setMessage({ type: 'success', text: 'Settings saved successfully' })
                setInputs({ openai_key: '', anthropic_key: '', grok_key: '', gemini_key: '' }) // Clear inputs
                fetchSettings() // Refresh status
            } else {
                setMessage({ type: 'error', text: 'Failed to save settings' })
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Error saving settings' })
        } finally {
            setSaving(false)
        }
    }

    if (loading) return <div className="p-8 text-center text-slate-500">Loading settings...</div>

    return (
        <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">System Settings</h1>
            <p className="text-slate-600 dark:text-slate-400 mb-8">Configure AI providers and system parameters.</p>

            <form onSubmit={handleSave} className="card p-6 space-y-8">
                {/* Provider Selection */}
                <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">AI Provider</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <label className={`
                            cursor-pointer p-4 rounded-lg border-2 transition-all block
                            ${provider === 'openai'
                                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}
                        `}>
                            <input
                                type="radio"
                                name="provider"
                                value="openai"
                                checked={provider === 'openai'}
                                onChange={(e) => setProvider(e.target.value)}
                                className="sr-only"
                            />
                            <div className="font-medium text-slate-900 dark:text-white">OpenAI</div>
                            <div className="text-sm text-slate-500">GPT-4o, GPT-4o-mini</div>
                        </label>

                        <label className={`
                            cursor-pointer p-4 rounded-lg border-2 transition-all block
                            ${provider === 'anthropic'
                                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}
                        `}>
                            <input
                                type="radio"
                                name="provider"
                                value="anthropic"
                                checked={provider === 'anthropic'}
                                onChange={(e) => setProvider(e.target.value)}
                                className="sr-only"
                            />
                            <div className="font-medium text-slate-900 dark:text-white">Anthropic</div>
                            <div className="text-sm text-slate-500">Claude 3.5 Sonnet</div>
                        </label>

                        <label className={`
                            cursor-pointer p-4 rounded-lg border-2 transition-all block
                            ${provider === 'grok'
                                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}
                        `}>
                            <input
                                type="radio"
                                name="provider"
                                value="grok"
                                checked={provider === 'grok'}
                                onChange={(e) => setProvider(e.target.value)}
                                className="sr-only"
                            />
                            <div className="font-medium text-slate-900 dark:text-white">xAI (Grok)</div>
                            <div className="text-sm text-slate-500">Grok Beta</div>
                        </label>

                        <label className={`
                            cursor-pointer p-4 rounded-lg border-2 transition-all block
                            ${provider === 'gemini'
                                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}
                        `}>
                            <input
                                type="radio"
                                name="provider"
                                value="gemini"
                                checked={provider === 'gemini'}
                                onChange={(e) => setProvider(e.target.value)}
                                className="sr-only"
                            />
                            <div className="font-medium text-slate-900 dark:text-white">Google Gemini</div>
                            <div className="text-sm text-slate-500">Gemini 2.5 Flash (FREE)</div>
                        </label>
                    </div>
                </div>

                <div className="border-t border-slate-200 dark:border-slate-700 pt-6"></div>

                {/* API Keys */}
                <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">API Keys</h3>
                    <p className="text-sm text-slate-500 mb-6">
                        Enter keys for the providers you wish to use. Keys are encrypted at rest.
                        Leave blank to keep existing keys.
                    </p>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                OpenAI API Key
                                {status.openai && <span className="ml-2 text-xs text-green-600 font-normal">✓ Configured</span>}
                            </label>
                            <input
                                type="password"
                                value={inputs.openai_key}
                                onChange={(e) => setInputs({ ...inputs, openai_key: e.target.value })}
                                placeholder={status.openai ? '••••••••••••••••' : 'sk-...'}
                                className="input w-full max-w-lg"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Anthropic API Key
                                {status.anthropic && <span className="ml-2 text-xs text-green-600 font-normal">✓ Configured</span>}
                            </label>
                            <input
                                type="password"
                                value={inputs.anthropic_key}
                                onChange={(e) => setInputs({ ...inputs, anthropic_key: e.target.value })}
                                placeholder={status.anthropic ? '••••••••••••••••' : 'sk-ant-...'}
                                className="input w-full max-w-lg"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Grok (xAI) API Key
                                {status.grok && <span className="ml-2 text-xs text-green-600 font-normal">✓ Configured</span>}
                            </label>
                            <input
                                type="password"
                                value={inputs.grok_key}
                                onChange={(e) => setInputs({ ...inputs, grok_key: e.target.value })}
                                placeholder={status.grok ? '••••••••••••••••' : 'xai-...'}
                                className="input w-full max-w-lg"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Gemini API Key
                                {status.gemini && <span className="ml-2 text-xs text-green-600 font-normal">✓ Configured</span>}
                            </label>
                            <input
                                type="password"
                                value={inputs.gemini_key}
                                onChange={(e) => setInputs({ ...inputs, gemini_key: e.target.value })}
                                placeholder={status.gemini ? '••••••••••••••••' : 'AIza...'}
                                className="input w-full max-w-lg"
                            />
                        </div>
                    </div>
                </div>

                <div className="pt-4 flex items-center gap-4">
                    <button
                        type="submit"
                        disabled={saving}
                        className="btn-primary px-8"
                    >
                        {saving ? 'Saving...' : 'Save Settings'}
                    </button>
                    {message && (
                        <span className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'
                            }`}>
                            {message.text}
                        </span>
                    )}
                </div>
            </form>
        </div>
    )
}
