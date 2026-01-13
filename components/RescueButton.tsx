"use client"

import { useState } from 'react'
import { RotateCcw, Loader2 } from 'lucide-react'
import { rescueSignalsAction } from '@/app/actions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export default function RescueButton() {
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleRescue = async () => {
        setLoading(true);
        try {
            const result = await rescueSignalsAction();
            if (result.success) {
                toast.success(`Rescued ${result.count} signals to Review Queue`);
                router.refresh();
            } else {
                toast.error("Rescue failed: " + result.error);
            }
        } catch (e) {
            toast.error("Rescue failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleRescue}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 text-xs text-amber-500 hover:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg transition-colors border border-amber-500/20"
            title="Move recent drafts back to Pending"
        >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
            Find Missing Items
        </button>
    )
}
