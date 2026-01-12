'use client'

import { useState } from 'react'
import { Plus, Trash2, Power, Globe, Rss } from 'lucide-react'
import { supabase } from '@/lib/supabase' // Start using client connection for simple toggles or move to actions if needed

// We need a server action for mutations optimally, but for MVP client-side supabase is fine if RLS allows, 
// otherwise we should use a server action. 
// Let's create a server action for "toggleSource" and "addSource" to be safe and consistent.
// Wait, I should create those actions first. 
// For now I will scaffold the UI and assume I will add `addSourceAction` and `toggleSourceAction` to app/actions.ts

import { addSourceAction, toggleSourceAction, deleteSourceAction } from '@/app/actions'

export default function SourceManager({ initialSources }: { initialSources: any[] }) {
    const [sources, setSources] = useState(initialSources)
    const [url, setUrl] = useState('')
    const [name, setName] = useState('')
    const [loading, setLoading] = useState(false)

    const handleAdd = async () => {
        if (!url || !name) return;
        setLoading(true)
        const newSource = await addSourceAction(name, url);
        if (newSource) {
            setSources([newSource, ...sources])
            setName('')
            setUrl('')
        }
        setLoading(false)
    }

    const handleToggle = async (id: string, currentState: boolean) => {
        // Optimistic update
        setSources(sources.map(s => s.id === id ? { ...s, active: !currentState } : s))
        await toggleSourceAction(id, !currentState)
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Stop tracking this source?")) return;
        setSources(sources.filter(s => s.id !== id))
        await deleteSourceAction(id)
    }

    return (
        <div className="space-y-6">
            {/* Add Form */}
            <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Plus className="w-5 h-5 text-cyan-400" /> Add Signal Source
                </h3>
                <div className="flex gap-4">
                    <input
                        value={name} onChange={e => setName(e.target.value)}
                        placeholder="Source Name (e.g. Toronto Star)"
                        className="flex-1 bg-black/50 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-cyan-500/50"
                    />
                    <input
                        value={url} onChange={e => setUrl(e.target.value)}
                        placeholder="RSS Feed URL"
                        className="flex-[2] bg-black/50 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-cyan-500/50 font-mono text-sm"
                    />
                    <button
                        onClick={handleAdd} disabled={!name || !url || loading}
                        className="bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-2 rounded-lg font-medium disabled:opacity-50"
                    >
                        {loading ? 'Adding...' : 'Add Feed'}
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="space-y-4">
                {sources.map(source => (
                    <div key={source.id} className={`p-4 rounded-xl border transition-all flex items-center justify-between ${source.active ? 'bg-white/[0.02] border-white/10' : 'bg-red-500/5 border-red-500/20 grayscale opacity-70'}`}>
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-full ${source.active ? 'bg-cyan-500/10 text-cyan-400' : 'bg-white/5 text-gray-500'}`}>
                                <Rss className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="font-semibold text-white">{source.name}</h4>
                                <div className="flex items-center gap-2 text-xs text-gray-500 font-mono mt-1">
                                    <Globe className="w-3 h-3" />
                                    {source.url}
                                    <span className="px-1.5 py-0.5 rounded bg-white/10 text-gray-400 uppercase tracking-widest text-[9px]">{source.category || 'general'}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => handleToggle(source.id, source.active)}
                                className={`p-2 rounded-lg transition-colors ${source.active ? 'hover:bg-green-500/20 text-green-400' : 'hover:bg-white/10 text-gray-500'}`}
                                title={source.active ? "Pause Ingest" : "Resume Ingest"}
                            >
                                <Power className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => handleDelete(source.id)}
                                className="p-2 rounded-lg hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
