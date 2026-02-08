import Link from 'next/link'

export function Footer() {
    return (
        <footer className="relative z-10 border-t border-white/[0.04]">
            <div className="max-w-6xl mx-auto px-6 py-10">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center">
                            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" className="text-white">
                                <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
                                <circle cx="8" cy="8" r="1" fill="currentColor" />
                            </svg>
                        </div>
                        <span className="text-sm font-semibold text-slate-400 tracking-wider uppercase">Canopticon</span>
                    </div>
                    <div className="flex items-center gap-6 text-xs text-slate-600">
                        <span>&copy; {new Date().getFullYear()} Canopticon</span>
                        <Link href="/terms" className="hover:text-slate-300 transition-colors">Terms</Link>
                        <Link href="/privacy" className="hover:text-slate-300 transition-colors">Privacy</Link>
                    </div>
                </div>
            </div>
        </footer>
    )
}
