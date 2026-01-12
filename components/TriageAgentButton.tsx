"use client"

import { useState } from 'react'
import { runBatchTriageAction } from '@/app/actions'
import { useRouter } from 'next/navigation'
import { Loader2, BrainCircuit } from 'lucide-react'

export default function TriageAgentButton() {
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const handleRunTriage = async () => {
        setLoading(true)
        try {
            const result = await runBatchTriageAction()
            console.log("Batch Triage Result:", result)
            if (result.count > 0) {
                // In a real app, use a toast here. For now, we rely on the refresh showing the changes.
            }
            router.refresh()
        } catch (error) {
            console.error("Triage Failed:", error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <button
            onClick={handleRunTriage}
            disabled={loading}
            className={`
                relative inline-flex h-12 overflow-hidden rounded-full p-[1px] focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 focus:ring-offset-slate-50
                ${loading ? 'opacity-70 cursor-not-allowed' : 'hover:scale-105 transition-transform'}
            `}
        >
            <span className="absolute inset-[-1000%] animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#E2CBFF_0%,#393BB2_50%,#E2CBFF_100%)]" />
            <span className="inline-flex h-full w-full cursor-pointer items-center justify-center rounded-full bg-slate-950 px-6 py-1 text-sm font-medium text-white backdrop-blur-3xl gap-2">
                {loading ? (
                    <>
                        <Loader2 className="w-4 h-4 animate-spin text-yellow-400" />
                        <span className="text-yellow-400">Agent Thinking...</span>
                    </>
                ) : (
                    <>
                        <BrainCircuit className="w-4 h-4 text-yellow-400" />
                        Run Agent
                    </>
                )}
            </span>
        </button>
    )
}
