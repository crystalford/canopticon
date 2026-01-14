'use client'

import Link from 'next/link'

export default function ManualSourcesPage() {
    return (
        <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                Manual Sources
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mb-8">
                Manage legacy ingestion pipelines, RSS feeds, and raw signals.
            </p>

            <div className="grid md:grid-cols-2 gap-6">
                {/* RSS Sources Card */}
                <Link href="/dashboard/sources" className="block group">
                    <div className="card p-6 h-full hover:shadow-lg transition-all border-l-4 border-l-blue-500">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">
                                RSS & JSON Sources
                            </h2>
                            <span className="text-2xl">📡</span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 mb-4">
                            Configure automated data ingestion from RSS feeds, JSON endpoints, and Parliament data.
                        </p>
                        <span className="text-blue-600 dark:text-blue-400 font-medium group-hover:underline">
                            Manage Sources →
                        </span>
                    </div>
                </Link>

                {/* Signals Card */}
                <Link href="/dashboard/signal" className="block group">
                    <div className="card p-6 h-full hover:shadow-lg transition-all border-l-4 border-l-purple-500">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-purple-600 transition-colors">
                                Raw Signals
                            </h2>
                            <span className="text-2xl">📶</span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 mb-4">
                            View and triage raw signals ingested from configured sources before they are processed.
                        </p>
                        <span className="text-purple-600 dark:text-purple-400 font-medium group-hover:underline">
                            View Signals →
                        </span>
                    </div>
                </Link>
            </div>

            <div className="mt-12 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider mb-4">
                    Legacy Pipeline Status
                </h3>
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <div>System operational</div>
                </div>
            </div>
        </div>
    )
}
