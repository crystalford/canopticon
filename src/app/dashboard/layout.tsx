import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, FileText, Settings, Globe, PlusCircle, Newspaper } from 'lucide-react'

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    // Check authentication
    const session = await getServerSession()

    if (!session) {
        redirect('/login')
    }

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden font-sans">
            {/* Sidebar */}
            <aside className="w-64 bg-slate-900 border-r border-slate-800 flex-shrink-0 flex flex-col hidden md:flex">
                {/* Logo Area */}
                <div className="h-16 flex items-center px-6 border-b border-slate-800">
                    <Link href="/dashboard" className="flex items-center gap-2 group">
                        <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center shadow-lg shadow-primary-500/20 group-hover:shadow-primary-500/40 transition-shadow">
                            <span className="text-white font-bold text-lg">C</span>
                        </div>
                        <span className="font-bold text-xl tracking-tight text-slate-100 group-hover:text-white transition-colors">
                            CANOPTICON
                        </span>
                    </Link>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
                    <div className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Intelligence
                    </div>

                    <NavLink href="/dashboard" icon={LayoutDashboard} label="Daily Brief" />
                    <NavLink href="/dashboard/articles" icon={FileText} label="Articles" />

                    <div className="px-3 mt-8 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Sources
                    </div>

                    <NavLink href="/dashboard/manual-sources" icon={PlusCircle} label="Manual Ingest" />
                    <NavLink href="/dashboard/sources" icon={Newspaper} label="Source Monitor" />

                    <div className="px-3 mt-8 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        System
                    </div>

                    <NavLink href="/dashboard/settings" icon={Settings} label="Settings" />
                    <NavLink href="/" icon={Globe} label="View Public Site" />
                </nav>

                {/* User Footer */}
                <div className="p-4 border-t border-slate-800 bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-medium text-slate-300">
                            {session.user?.email?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-medium text-slate-200 truncate">
                                {session.user?.name || 'Operator'}
                            </p>
                            <p className="text-xs text-slate-500 truncate">
                                {session.user?.email}
                            </p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col overflow-hidden relative">
                {/* Top Mobile Bar (visible only on small screens) */}
                <header className="md:hidden bg-slate-900 border-b border-slate-800 h-16 flex items-center px-4 justify-between shrink-0">
                    <span className="font-bold text-lg text-slate-100">CANOPTICON</span>
                    {/* Add mobile menu trigger here if needed */}
                </header>

                {/* Scrollable Content */}
                <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                    <div className="max-w-7xl mx-auto p-6 md:p-8 lg:p-10">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    )
}

// Helper Component for Nav Links
function NavLink({ href, icon: Icon, label }: { href: string; icon: any; label: string }) {
    return (
        <Link
            href={href}
            className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-400 rounded-md hover:bg-slate-800 hover:text-white transition-all group"
        >
            <Icon className="w-5 h-5 text-slate-500 group-hover:text-primary-400 transition-colors" />
            {label}
        </Link>
    )
}
