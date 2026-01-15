'use client'

import Link from 'next/link'
import { Database, FileText } from 'lucide-react'

export default function ManualSourcesPage() {
    return (
        <div className="space-y-8">
            <div className="pb-6 border-b border-white/5">
                <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">
                    Manual Sources
                </h1>
                <p className="text-slate-400 text-sm">
                    Manage legacy ingestion pipelines, RSS feeds, and raw signals.
                </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                {/* RSS Sources Card */}
                <Link href="/dashboard/sources" className="glass-card p-8 group hover:border-primary-500/20 transition-all">
                    <div className="flex items-center justify-between mb-4">
                        <Database className="w-8 h-8 text-primary-400" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2 group-hover:text-primary-400 transition-colors">
                        RSS & JSON Sources
                    </h2>
                    <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                        Configure automated data ingestion from RSS feeds, JSON endpoints, and Parliament data.
                    </p>
                    <span className="text-primary-400 text-sm font-medium group-hover:underline">
                        Manage Sources →
                    </span>
                </Link>

                {/* Signals Card */}
                <Link href="/dashboard/signal" className="glass-card p-8 group hover:border-primary-500/20 transition-all">
                    <div className="flex items-center justify-between mb-4">
                        <FileText className="w-8 h-8 text-primary-400" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2 group-hover:text-primary-400 transition-colors">
                        Raw Signals
                    </h2>
                    <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                        View and triage raw signals ingested from configured sources before processing.
                    </p>
                    <span className="text-primary-400 text-sm font-medium group-hover:underline">
                        View Signals →
                    </span>
                </Link>
            </div>

            <div className="glass-panel p-6">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
                    Legacy Pipeline Status
                </h3>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <div>System operational</div>
                </div>
            </div>
        </div>
    )
}
