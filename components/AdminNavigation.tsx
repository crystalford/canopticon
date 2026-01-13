"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion } from "framer-motion"
import { LayoutDashboard, Inbox, Settings, Shield, Radio, ExternalLink, FileText, TrendingUp } from "lucide-react"
import { UserButton } from "@clerk/nextjs"

type CurrentPage = 'dashboard' | 'review' | 'settings' | 'sources' | 'content' | 'trends';

export default function AdminNavigation({ currentPage }: { currentPage: CurrentPage }) {
    const pathname = usePathname();

    const adminLinks = [
        { name: 'Dashboard', href: '/admin/dashboard', id: 'dashboard', icon: LayoutDashboard },
        { name: 'Review', href: '/admin/review/pending', id: 'review', icon: Inbox },
        { name: 'Content', href: '/admin/content', id: 'content', icon: FileText },
        { name: 'Sources', href: '/admin/sources', id: 'sources', icon: Radio },
        { name: 'Social', href: '/admin/trends', id: 'trends', icon: TrendingUp },
        { name: 'Settings', href: '/admin/settings', id: 'settings', icon: Settings },
    ];

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 px-8 py-6 pointer-events-none">
            <div className="max-w-7xl mx-auto flex justify-between items-center">
                {/* Logo Area with Admin Badge */}
                <Link href="/admin/dashboard" className="pointer-events-auto flex items-center gap-3 group">
                    <div className="relative w-10 h-10 flex items-center justify-center bg-black/80 backdrop-blur-xl border border-red-500/50 rounded-xl group-hover:border-red-400 transition-colors">
                        <Shield className="w-5 h-5 text-red-400 group-hover:text-red-300 transition-colors" />
                    </div>
                    <div>
                        <span className="font-bold tracking-tight text-white/80 group-hover:text-white transition-colors block">
                            CANOPTICON
                        </span>
                        <span className="text-xs text-red-400 font-mono uppercase tracking-wider">
                            Admin Console
                        </span>
                    </div>
                </Link>

                {/* Admin Navigation Pill */}
                <div className="pointer-events-auto bg-black/80 backdrop-blur-2xl border border-red-500/30 rounded-full p-1.5 flex gap-1 shadow-2xl shadow-red-500/10">
                    {adminLinks.map((link) => {
                        const isActive = currentPage === link.id;
                        const Icon = link.icon;

                        return (
                            <Link
                                key={link.id}
                                href={link.href}
                                className={`
                  relative px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200
                  flex items-center gap-2
                  ${isActive ? 'text-black' : 'text-gray-400 hover:text-white hover:bg-white/5'}
                `}
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="adminActivePill"
                                        className="absolute inset-0 bg-red-400 rounded-full"
                                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                    />
                                )}
                                <span className="relative z-10 flex items-center gap-2">
                                    <Icon className="w-4 h-4" />
                                    {link.name}
                                </span>
                            </Link>
                        )
                    })}
                </div>

                {/* Right Area - View Public Site + User */}
                <div className="pointer-events-auto flex items-center gap-4">
                    <Link
                        href="/"
                        className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm text-gray-400 hover:text-white transition-colors"
                    >
                        <ExternalLink className="w-4 h-4" />
                        View Public Site
                    </Link>
                    <UserButton afterSignOutUrl="/" />
                </div>
            </div>
        </nav>
    )
}
