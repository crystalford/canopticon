"use client"

import { toast } from 'sonner'
import { useState } from 'react'
import { runIngestAction } from '@/app/actions'
import { useRouter } from 'next/navigation'
import { Loader2, Radio } from 'lucide-react'
import LiquidChromeButton from './LiquidChromeButton'

export default function ForceIngestButton() {
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const handleIngest = async () => {
        setLoading(true)
        const toastId = toast.loading("Ingesting signals...");
        try {
            const result: any = await runIngestAction()
            if (result.success) {
                toast.success(result.message || `Ingest Complete. Found ${result.count} signals.`, { id: toastId });
                router.refresh()
            } else {
                toast.error("Ingest Failed: " + result.error, { id: toastId });
            }
        } catch (error: any) {
            console.error("Ingest Failed:", error)
            toast.error("Ingest Exception: " + error.message, { id: toastId });
        } finally {
            setLoading(false)
        }
    }

    // Using LiquidChromeButton's style but overriding behavior
    return (
        <button onClick={handleIngest} disabled={loading} className="relative group">
            <LiquidChromeButton>
                {loading ? (
                    <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> Ingesting...
                    </span>
                ) : (
                    <span className="flex items-center gap-2">
                        <Radio className="w-4 h-4" /> Force Ingest
                    </span>
                )}
            </LiquidChromeButton>
        </button>
    )
}
