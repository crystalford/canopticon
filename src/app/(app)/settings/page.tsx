'use client'

import { useState, useEffect } from 'react'
import { Save, Plus, Trash2, Key, Bot, Cpu, Edit2, Check, X } from 'lucide-react'

export default function SettingsPage() {
    const [settings, setSettings] = useState<Record<string, string>>({})
    const [agents, setAgents] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    // Agent Editor State
    const [editingAgent, setEditingAgent] = useState<any | null>(null)
    const [isNewAgent, setIsNewAgent] = useState(false)

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        setLoading(true)
        try {
            const [s, a] = await Promise.all([
                fetch('/api/settings').then(res => res.json()),
                fetch('/api/agents').then(res => res.json())
            ])
            setSettings(s)
            setAgents(a)
        } catch (error) {
            console.error('Failed to load settings', error)
        } finally {
            setLoading(false)
        }
    }

    const saveSettings = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        try {
            await fetch('/api/settings', {
                method: 'POST',
                body: JSON.stringify(settings)
            })
            alert('Settings saved!')
        } catch (error) {
            alert('Failed to save settings')
        } finally {
            setSaving(false)
        }
    }

    const saveAgent = async (agent: any) => {
        try {
            const res = await fetch('/api/agents', {
                method: 'POST',
                body: JSON.stringify(agent)
            })
            if (!res.ok) throw new Error('Failed to save')
            await fetchData() // Refresh
            setEditingAgent(null)
            setIsNewAgent(false)
        } catch (error) {
            alert('Failed to save agent')
        }
    }

    if (loading) return <div className="p-10 text-center text-slate-500">Loading configuration...</div>

    return (
        <div className="max-w-5xl mx-auto p-8 space-y-12">

            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-white mb-2">System Settings & Intelligence</h1>
                <p className="text-slate-400">Configure LLM providers and manage your AI workforce.</p>
            </div>

            {/* API Keys Section */}
            <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400">
                        <Key size={20} />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-white">LLM Configuration</h2>
                        <p className="text-sm text-slate-400">API keys are stored securely. Leave blank to use defaults.</p>
                    </div>
                </div>

                <form onSubmit={saveSettings} className="space-y-4 max-w-xl">
                    {/* Default Model Provider */}
                    <div className="pb-4 border-b border-white/10">
                        <label className="block text-xs font-medium text-slate-400 uppercase mb-2">Default Model Provider</label>
                        <select
                            value={settings.DEFAULT_MODEL_PROVIDER || 'perplexity'}
                            onChange={e => setSettings({ ...settings, DEFAULT_MODEL_PROVIDER: e.target.value })}
                            className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-purple-500/50 appearance-none cursor-pointer"
                        >
                            <option value="perplexity">Perplexity Sonar Pro (Recommended)</option>
                            <option value="openai">OpenAI GPT-4o</option>
                            <option value="anthropic">Anthropic Claude</option>
                        </select>
                        <p className="text-xs text-slate-500 mt-1">Used for all automations and default chat behavior</p>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-400 uppercase mb-1">OpenAI API Key</label>
                        <input
                            type="password"
                            name="OPENAI_API_KEY"
                            value={settings.OPENAI_API_KEY || ''}
                            onChange={e => setSettings({ ...settings, OPENAI_API_KEY: e.target.value })}
                            placeholder="sk-..."
                            className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:border-purple-500/50 outline-none transition-colors"
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-medium text-slate-400 uppercase mb-1">Perplexity API Key</label>
                    <input
                        type="password"
                        name="PERPLEXITY_API_KEY"
                        value={settings.PERPLEXITY_API_KEY || ''}
                        onChange={e => setSettings({ ...settings, PERPLEXITY_API_KEY: e.target.value })}
                        placeholder="pplx-..."
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:border-purple-500/50 outline-none transition-colors"
                    />
                </div>
                <div className="pt-2">
                    <button
                        type="submit"
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                        <Save size={16} />
                        {saving ? 'Saving...' : 'Save Configuration'}
                    </button>
                </div>
            </form>
        </section>

            {/* Agents Section */ }
    <section>
        <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                    <Bot size={20} />
                </div>
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
                            onClick={() => { setEditingAgent(agent); setIsNewAgent(false); }}
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

    {/* Agent Editor Modal */ }
    {
        editingAgent && (
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
        )
    }
        </div >
    )
}
