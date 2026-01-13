"use client"

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LayoutDashboard, Radio, FileText, Settings, Search, Filter, AlertCircle, X, Users, Activity, ExternalLink } from 'lucide-react'
import ContentItem from './ContentItem'
import { Signal, Publication } from '@/types'

interface DashboardProps {
    stats: {
        totalSignals: number;
        pendingTriage: number;
        published: number;
        systemHealth: number;
    };
}

export default function CMSDashboard({ stats }: DashboardProps) {
    const [activeTab, setActiveTab] = useState<'wire' | 'editorial' | 'settings'>('wire')
    const [searchQuery, setSearchQuery] = useState('')

    return (
        <div className="space-y-8">
            {/* Header Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatsCard
                    label="Total Intercepts"
                    value={stats.totalSignals}
                    icon={Radio}
                    color="text-cyan-400"
                    trend="+12%"
                />
                <StatsCard
                    label="The Wire (Pending)"
                    value={stats.pendingTriage}
                    icon={AlertCircle}
                    color="text-yellow-400"
                    alert={stats.pendingTriage > 50}
                />
                <StatsCard
                    label="Published"
                    value={stats.published}
                    icon={ExternalLink}
                    color="text-green-400"
                    trend="+5%"
                />
                <StatsCard
                    label="System Health"
                    value={`${stats.systemHealth}%`}
                    icon={Activity}
                    color="text-purple-400"
                />
            </div>

            {/* Main Interface */}
            <div className="bg-[#0A0A0A] border border-white/10 rounded-3xl overflow-hidden min-h-[600px]">

                {/* Toolbar */}
                <div className="border-b border-white/10 p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex gap-2 bg-black/50 p-1 rounded-full border border-white/5">
                        <TabButton active={activeTab === 'wire'} onClick={() => setActiveTab('wire')} icon={Radio} label="The Wire" />
                        <TabButton active={activeTab === 'editorial'} onClick={() => setActiveTab('editorial')} icon={FileText} label="Editorial Desk" />
                        <TabButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={Settings} label="Mission Control" />
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="relative group flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-cyan-400 transition-colors" />
                            <input
                                type="text"
                                placeholder="Search signals..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-full pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50 transition-all font-mono"
                            />
                        </div>
                        <button className="p-2 rounded-full border border-white/10 hover:bg-white/5 text-gray-400 hover:text-white transition-colors">
                            <Filter className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="p-0">
                    <AnimatePresence mode="wait">
                        {activeTab === 'wire' && (
                            <motion.div
                                key="wire"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="p-8 text-center text-gray-400"
                            >
                                <div className="max-w-md mx-auto py-12">
                                    <Radio className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                                    <h3 className="text-xl font-bold text-white mb-2">The Wire is monitored elsewhere.</h3>
                                    <p className="mb-6">Please use the dedicated &quot;Review Wire&quot; interface for high-speed triage.</p>
                                    <a href="/admin/review/pending" className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-full font-medium transition-colors">
                                        Go to Review Interface
                                    </a>
                                </div>
                            </motion.div>
                        )}

                        {activeTab === 'editorial' && (
                            <motion.div
                                key="editorial"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                            >
                                <div className="p-8 text-center text-gray-400">
                                    <p>Editorial Desk functionality coming in Phase 1.5. Currently managing via &apos;Review&apos; and &apos;Archive&apos;.</p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

            </div>
        </div>
    )
}

function StatsCard({ label, value, icon: Icon, color, trend, alert = false }: any) {
    return (
        <div className={`p-6 rounded-2xl border ${alert ? 'bg-red-500/10 border-red-500/50' : 'bg-[#0A0A0A] border-white/10'} relative overflow-hidden group hover:border-white/20 transition-colors`}>
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-xl bg-white/5 ${color} group-hover:scale-110 transition-transform`}>
                    <Icon className="w-6 h-6" />
                </div>
                {trend && <span className="text-xs font-mono text-green-400 bg-green-500/10 px-2 py-1 rounded-full">{trend}</span>}
            </div>
            <div className="space-y-1">
                <h3 className="text-3xl font-bold tracking-tight text-white font-mono">{value}</h3>
                <p className="text-sm text-gray-400 font-medium">{label}</p>
            </div>
        </div>
    )
}

function TabButton({ active, onClick, icon: Icon, label }: any) {
    return (
        <button
            onClick={onClick}
            className={`
                flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all
                ${active ? 'bg-white text-black shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/10'}
            `}
        >
            <Icon className="w-4 h-4" />
            {label}
        </button>
    )
}
