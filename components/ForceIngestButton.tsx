"use client"

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
        try {
            const result: any = await runIngestAction()
            if (result.success) {
                alert(`Ingest Complete. Found ${result.count} signals. (DB Total: ${result.dbCount})`);
                router.refresh()
            } else {
                alert("Ingest Failed from Server: " + result.error);
            }
        } catch (error: any) {
            console.error("Ingest Failed:", error)
            alert("Ingest Exception: " + (error.message || "Unknown error"));
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
