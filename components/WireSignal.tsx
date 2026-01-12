"use client"

import { Signal } from '@/types'
import { Check, X, ExternalLink, Clock } from 'lucide-react'
import { updateSignalStatusAction } from '@/app/actions'
import { useState } from 'react'

import { useRouter } from 'next/navigation'

export default function WireSignal({ signal }: { signal: Signal }) {
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const handleAction = async (status: 'processing' | 'archived') => {
        setLoading(true)
        try {
            await updateSignalStatusAction(signal.id, status)
            router.refresh()
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="p-3 border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
            <div className="flex justify-between items-start gap-2 mb-1">
                <span className="text-[10px] font-mono text-cyan-500/70">{signal.source}</span>
                <span className="text-[10px] text-gray-600 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(signal.publishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
            </div>

            <h4 className="text-sm font-medium text-gray-200 mb-2 leading-tight group-hover:text-white transition-colors">
                <a href={signal.url} target="_blank" rel="noreferrer" className="hover:underline decoration-cyan-500/50">
                    {signal.headline}
                </a>
            </h4>

            <div className="flex items-center gap-2 mt-2 opacity-50 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={() => handleAction('processing')}
                    disabled={loading}
                    className="flex-1 bg-green-500/10 hover:bg-green-500/20 text-green-400 hover:text-green-300 py-1 rounded text-xs font-medium flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                >
                    <Check className="w-3 h-3" /> Approve
                </button>
                <button
                    onClick={() => handleAction('archived')}
                    disabled={loading}
                    className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 py-1 rounded text-xs font-medium flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                >
                    <X className="w-3 h-3" /> Dismiss
                </button>
            </div>
        </div>
    )
}
