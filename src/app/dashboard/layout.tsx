import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, FileText, Settings, Globe, PlusCircle, Newspaper, User, Radio, Microscope, Flame, Send, Film, Database } from 'lucide-react'

import Logo from '@/components/Logo'

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const session = await getServerSession()
    if (!session) redirect('/login')

    return (
        <div className="flex h-screen overflow-hidden font-sans text-slate-300">
            {/* Glass Sidebar */}
            <aside className="w-64 flex-shrink-0 flex flex-col border-r border-white/5 bg-black/20 backdrop-blur-xl hidden md:flex">
                {/* Logo */}
                <div className="h-16 flex items-center px-6 border-b border-white/5">
                    <Link href="/dashboard" className="w-full">
                        <Logo />
                    </Link>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
                    <NavSection title="Automation" />
                    <NavLink href="/dashboard" icon={LayoutDashboard} label="Control Panel" />
                    <NavLink href="/dashboard/articles" icon={FileText} label="Published Articles" />
                    <NavLink href="/dashboard/feed" icon={Radio} label="Raw Feed" />
                    <NavLink href="/dashboard/archive" icon={Database} label="Archive" />

                    <NavSection title="Social Distribution" className="mt-8" />
                    <NavLink href="/dashboard/broadcaster" icon={Send} label="Broadcaster" />

                    <NavSection title="Settings" className="mt-8" />
                    <NavLink href="/dashboard/settings" icon={Settings} label="Configuration" />
                    <NavLink href="/" icon={Globe} label="Public Site" />
                </nav>

                {/* User Footer */}
                <div className="p-4 border-t border-white/5 bg-white/5 mx-3 mb-3 rounded-xl">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary-500/20 border border-primary-500/30 flex items-center justify-center text-primary-300">
                            <User className="w-5 h-5" />
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-medium text-white truncate">
                                {session.user?.name || 'Operator'}
                            </p>
                            <p className="text-xs text-slate-500 truncate">
                                {session.user?.email}
                            </p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden relative">
                <main className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
                    <div className="max-w-7xl mx-auto p-6 md:p-10">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    )
}

function NavSection({ title, className = '' }: { title: string, className?: string }) {
    return (
        <div className={`px-3 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest ${className}`}>
            {title}
        </div>
    )
}

function NavLink({ href, icon: Icon, label }: { href: string; icon: any; label: string }) {
    return (
        <Link
            href={href}
            className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-400 rounded-lg hover:bg-white/5 hover:text-white transition-all group"
        >
            <Icon className="w-4 h-4 text-slate-500 group-hover:text-primary-400 transition-colors" />
            {label}
        </Link>
    )
}
