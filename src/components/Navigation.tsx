import Link from 'next/link'

export function Navigation() {
    return (
        <nav className="relative z-10 border-b border-white/[0.06]">
            <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-3 group">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-lg shadow-red-500/20 group-hover:shadow-red-500/40 transition-shadow">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-white">
                            <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
                            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1" opacity="0.5" />
                            <circle cx="8" cy="8" r="1" fill="currentColor" />
                        </svg>
                    </div>
                    <span className="text-lg font-bold text-white tracking-[0.2em] uppercase">
                        Canopticon
                    </span>
                </Link>
                <div className="flex items-center gap-6">
                    <Link href="/articles" className="text-sm text-slate-400 hover:text-white transition-colors">
                        Articles
                    </Link>
                    <Link
                        href="/dashboard"
                        className="text-sm px-4 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-slate-300 hover:bg-white/[0.1] hover:text-white hover:border-white/[0.15]"
                    >
                        Dashboard
                    </Link>
                </div>
            </div>
        </nav>
    )
}
