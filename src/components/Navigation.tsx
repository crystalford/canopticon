import Link from 'next/link'

export function Navigation() {
    return (
        <nav className="relative z-10 border-b border-white/[0.06]">
            <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-3 group">
                    {/* Canopticon Eye Mark */}
                    <div className="relative w-7 h-7 flex items-center justify-center">
                        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                            <defs>
                                <linearGradient id="nav-ring" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
                                    <stop offset="0%" stopColor="#cbd5e1" />
                                    <stop offset="100%" stopColor="#64748b" />
                                </linearGradient>
                                <radialGradient id="nav-glow" cx="14" cy="14" r="5" gradientUnits="userSpaceOnUse">
                                    <stop offset="0%" stopColor="#ef4444" />
                                    <stop offset="100%" stopColor="#dc2626" stopOpacity="0.6" />
                                </radialGradient>
                            </defs>
                            {/* Outer ring */}
                            <circle cx="14" cy="14" r="12.5" stroke="url(#nav-ring)" strokeWidth="1.5" fill="none" />
                            {/* Inner iris ring */}
                            <circle cx="14" cy="14" r="5.5" stroke="#ef4444" strokeWidth="1.2" fill="none" opacity="0.7" />
                            {/* Pupil */}
                            <circle cx="14" cy="14" r="2.5" fill="url(#nav-glow)" />
                        </svg>
                    </div>

                    {/* CAN-OPTI-CON Premium Typography */}
                    <div className="flex flex-col justify-center h-10">
                        <span className="text-xl font-black tracking-[0.2em] uppercase leading-none flex items-center">
                            <span className="text-white drop-shadow-md">CAN</span>
                            <span className="text-red-500 drop-shadow-md mx-0.5">OPTI</span>
                            <span className="text-white drop-shadow-md">CON</span>
                        </span>
                    </div>
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
