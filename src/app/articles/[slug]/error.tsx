'use client'

import { useEffect } from 'react'

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error(error)
    }, [error])

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-4">
            <div className="text-center space-y-4 max-w-md">
                <h2 className="text-2xl font-bold text-red-500">Something went wrong!</h2>
                <div className="p-4 bg-white/5 rounded-lg border border-white/10 text-left overflow-auto max-h-48">
                    <p className="text-sm font-mono text-slate-300 break-all">
                        {error.message || 'An unexpected error occurred.'}
                    </p>
                    {error.digest && (
                        <p className="text-xs font-mono text-slate-500 mt-2">
                            Digest: {error.digest}
                        </p>
                    )}
                </div>
                <div className="flex gap-4 justify-center">
                    <button
                        onClick={() => window.location.href = '/'}
                        className="px-4 py-2 bg-slate-800 rounded hover:bg-slate-700 transition"
                    >
                        Go Home
                    </button>
                    <button
                        onClick={() => reset()}
                        className="px-4 py-2 bg-primary-600 rounded hover:bg-primary-500 transition"
                    >
                        Try again
                    </button>
                </div>
            </div>
        </div>
    )
}
