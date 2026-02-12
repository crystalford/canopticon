import Link from 'next/link'

export function Navigation() {
    return (
        <nav className="relative z-10 border-b border-white/[0.06]">
            <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-3 group">
                    {/* Premium Metallic Aperture Logo */}
                    <div className="relative w-10 h-10 flex items-center justify-center">
                        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="drop-shadow-lg">
                            <defs>
                                <linearGradient id="metal-gradient" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                                    <stop offset="0%" stopColor="#e2e8f0" />
                                    <stop offset="50%" stopColor="#94a3b8" />
                                    <stop offset="100%" stopColor="#475569" />
                                </linearGradient>
                                <linearGradient id="red-glow" x1="0" y1="0" x2="40" y2="40">
                                    <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8" />
                                    <stop offset="100%" stopColor="#b91c1c" stopOpacity="1" />
                                </linearGradient>
                                <filter id="glow">
                                    <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                                    <feMerge>
                                        <feMergeNode in="coloredBlur" />
                                        <feMergeNode in="SourceGraphic" />
                                    </feMerge>
                                </filter>
                            </defs>

                            {/* Outer Ring */}
                            <circle cx="20" cy="20" r="18" stroke="url(#metal-gradient)" strokeWidth="2" fill="none" opacity="0.8" />

                            {/* Aperture Blades (Stylized) */}
                            <path d="M20 5 L20 15 M20 35 L20 25 M5 20 L15 20 M35 20 L25 20" stroke="url(#metal-gradient)" strokeWidth="1" opacity="0.5" />
                            <path d="M9.4 9.4 L16.5 16.5 M30.6 30.6 L23.5 23.5 M30.6 9.4 L23.5 16.5 M9.4 30.6 L16.5 23.5" stroke="url(#metal-gradient)" strokeWidth="1" opacity="0.5" />

                            {/* Inner Iris (Red) */}
                            <circle cx="20" cy="20" r="6" stroke="url(#red-glow)" strokeWidth="2" fill="none" filter="url(#glow)" />
                            <circle cx="20" cy="20" r="3" fill="#ef4444" opacity="0.5" filter="url(#glow)" />
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
