'use client'

import { approveSignal, deleteSignal } from '@/app/simple-actions'
import { useState } from 'react'

export default function ReviewCard({ signal }: { signal: any }) {
    const [loading, setLoading] = useState(false)

    const handleApprove = async () => {
        setLoading(true)
        await approveSignal(signal.id)
        window.location.reload()
    }

    const handleDelete = async () => {
        setLoading(true)
        await deleteSignal(signal.id)
        window.location.reload()
    }

    return (
        <div className="border border-gray-800 rounded-lg p-6 bg-gray-900/50 hover:bg-gray-900/70 transition-colors">
            <h3 className="text-xl font-bold mb-2 text-white">{signal.headline}</h3>
            <p className="text-gray-400 text-sm mb-4 line-clamp-3">
                {signal.summary || 'No summary available'}
            </p>

            <div className="flex gap-3 mb-4">
                <button
                    onClick={handleApprove}
                    disabled={loading}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-4 py-2 rounded font-medium transition-colors"
                >
                    ✓ Approve
                </button>

                <button
                    onClick={handleDelete}
                    disabled={loading}
                    className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 px-4 py-2 rounded font-medium transition-colors"
                >
                    ✗ Delete
                </button>
            </div>

            <div className="text-xs text-gray-600">
                <a href={signal.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 underline">
                    {signal.url}
                </a>
                <span className="mx-2">•</span>
                <span>{new Date(signal.published_at).toLocaleString()}</span>
            </div>
        </div>
    )
}
