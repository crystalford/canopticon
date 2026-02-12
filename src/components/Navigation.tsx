import Link from 'next/link'

export function Navigation() {
    return (
        <nav className="relative z-10 border-b border-white/[0.06]">
            <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-3 group">
                    {/* Restored "Eye/Lens" Logo */}
                    <div className="relative w-8 h-8 flex items-center justify-center">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 group-hover:text-white transition-colors">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="14.31" y1="8" x2="20.05" y2="17.94" />
                            <line x1="9.69" y1="8" x2="21.17" y2="8" />
                            <line x1="7.38" y1="12" x2="13.12" y2="2.06" />
                            <line x1="9.69" y1="16" x2="3.95" y2="6.06" />
                            <line x1="14.31" y1="16" x2="2.83" y2="16" />
                            <line x1="16.62" y1="12" x2="10.88" y2="21.94" />
                        </svg>
                        <div className="absolute inset-0 bg-red-500/10 rounded-full blur-sm opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>

                    {/* CAN-OPTI-CON Text Style */}
                    <span className="text-xl font-black tracking-tight uppercase leading-none">
                        <span className="text-white">CAN</span>
                        <span className="text-red-500">OPTI</span>
                        <span className="text-white">CON</span>
                    </span>
                </Link>
                <div className="flex items-center gap-6">
                    <Link href="/articles" className="text-sm text-slate-400 hover:text-white transition-colors">
                        Articles
                    </Link>
                    <Link
                        href="/chat"
                        className="text-sm px-4 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-slate-300 hover:bg-white/[0.1] hover:text-white hover:border-white/[0.15]"
                    >
                        Launch App
                    </Link>
                </div>
            </div>
        </nav>
    )
}
