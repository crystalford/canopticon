"use client"

import { useState } from 'react'
import { Video, Loader2, FileDown, Check } from 'lucide-react'
import { generateVideoMaterialsAction } from '@/app/actions'

interface VideoGeneratorProps {
    signalId: string;
    hasExistingMaterials?: boolean;
}

export default function VideoGenerator({ signalId, hasExistingMaterials = false }: VideoGeneratorProps) {
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(hasExistingMaterials);

    const handleGenerate = async () => {
        setLoading(true);
        const result = await generateVideoMaterialsAction(signalId);
        setLoading(false);

        if (result.success) {
            setSuccess(true);
        } else {
            alert("Generation failed: " + result.error);
        }
    };

    const handleDownload = () => {
        // TODO: Implement download logic via another action or pass data back
        // For now, simpler to just link to the article/manage page or re-fetch?
        // Actually, let's just alert for MVP or assume user goes to "Edit" page.
        alert("Materials ready in Editorial Desk.");
    };

    if (success) {
        return (
            <div className="flex gap-2">
                <button className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 text-green-400 rounded-lg text-xs font-medium border border-green-500/20 cursor-default">
                    <Check className="w-3 h-3" /> Ready
                </button>
                <button onClick={handleDownload} className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-xs font-medium border border-white/10 transition-colors">
                    <FileDown className="w-3 h-3" /> Export
                </button>
            </div>
        )
    }

    return (
        <button
            onClick={handleGenerate}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 rounded-lg text-xs font-bold border border-purple-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Video className="w-3 h-3" />}
            {loading ? "Generating..." : "Generate Prep"}
        </button>
    )
}
