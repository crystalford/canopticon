import Link from 'next/link'
import Logo from '@/components/Logo'
import { NewsletterForm } from '@/components/newsletter/NewsletterForm'

export default function HomePage() {

    return (
        <div className="min-h-screen bg-background text-slate-300 font-sans selection:bg-primary-500/30">
            {/* Nav */}
            <header className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-white/5">
                <div className="max-w-screen-xl mx-auto px-6 h-20 flex items-center justify-between">
                    <Link href="/">
                        <Logo />
                    </Link>
                    <Link href="/dashboard/ai-providers" className="text-xs font-bold text-slate-400 hover:text-white transition-colors tracking-widest uppercase flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        Dashboard
                    </Link>
                </div>
            </header>

            <main className="pt-20">
                {/* Hero Section */}
                <section className="relative pt-6 pb-12 md:pt-12 md:pb-16 overflow-hidden border-b border-white/10 mb-12">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary-900/10 via-background to-background z-0" />

                    <div className="container relative z-10 mx-auto px-4 text-center">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-primary-400 mb-6 animate-fade-in-up">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500"></span>
                            </span>
                            SYSTEM OPERATIONAL
                        </div>

                        <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter text-white mb-6 animate-fade-in-up md:leading-[0.9]">
                            UNFILTERED<br />
                            INTELLIGENCE
                        </h1>

                        <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-8 leading-relaxed animate-fade-in-up delay-100">
                            Operational intelligence for the information age. We deploy advanced forensic systems to uncover what matters in Canadian politics.
                        </p>

                        <div className="flex flex-col items-center gap-6 animate-fade-in-up delay-200">
                            <div className="w-full max-w-md bg-white/5 border border-white/10 p-2 rounded-xl backdrop-blur-sm">
                                <NewsletterForm />
                            </div>
                            <p className="text-xs text-slate-600">
                                Join 5,000+ subscribers receiving daily intelligence briefs.
                            </p>
                        </div>
                    </div>
                </section>

                <div className="px-6">
                    <div className="text-center py-20 border-t border-white/10">
                        <div className="text-slate-500 font-mono text-sm mb-4">SYSTEM INITIALIZING</div>
                        <div className="text-slate-600 text-xs">Intelligence pipeline coming online soon.</div>
                    </div>
                </div>
            </main>

            <footer className="border-t border-white/5 py-12 px-6 bg-black/20">
                <div className="max-w-screen-xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="text-slate-600 text-xs font-mono">
                        &copy; {new Date().getFullYear()} CANOPTICON INTELLIGENCE.
                    </div>
                    <div className="text-slate-700 text-xs tracking-widest uppercase">
                        Primary Source • Zero Bias • Real Time
                    </div>
                </div>
            </footer>
        </div>
    )
}
