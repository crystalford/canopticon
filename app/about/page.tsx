import PublicNavigation from '@/components/PublicNavigation'
import { Shield, Radio, Zap, Video, BarChart3 } from 'lucide-react'

export const metadata = {
    title: 'About - CANOPTICON',
    description: 'AI-powered political intelligence for Canadian content creators and analysts.',
}

export default function AboutPage() {
    return (
        <main className="min-h-screen bg-[#050505] text-white selection:bg-cyan-500/30">
            <PublicNavigation currentPage="about" />

            <div className="pt-32 pb-20 px-4 max-w-3xl mx-auto">
                <header className="mb-12 text-center">
                    <div className="flex items-center justify-center gap-3 mb-6">
                        <div className="p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl">
                            <Radio className="w-8 h-8 text-cyan-400" />
                        </div>
                    </div>
                    <h1 className="text-4xl font-bold mb-4">About CANOPTICON</h1>
                    <p className="text-xl text-gray-400">
                        AI-powered political intelligence for content creators and analysts.
                    </p>
                </header>

                <div className="space-y-8">
                    {/* Mission */}
                    <section className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl">
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                            <Shield className="w-6 h-6 text-cyan-400" />
                            Our Mission
                        </h2>
                        <p className="text-gray-300 leading-relaxed">
                            CANOPTICON is an AI-powered political intelligence platform designed to cut through the noise
                            and surface high-impact political signals for Canadian content creators, journalists, and analysts.
                        </p>
                    </section>

                    {/* How It Works */}
                    <section className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl">
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                            <Zap className="w-6 h-6 text-cyan-400" />
                            How It Works
                        </h2>
                        <div className="space-y-4 text-gray-300">
                            <div>
                                <h3 className="font-semibold text-white mb-2">1. Signal Ingestion</h3>
                                <p>We monitor Parliament bills, major news outlets, and independent sources 24/7.</p>
                            </div>
                            <div>
                                <h3 className="font-semibold text-white mb-2">2. AI Analysis</h3>
                                <p>Advanced filtering identifies politically relevant signals and scores them for impact and credibility.</p>
                            </div>
                            <div>
                                <h3 className="font-semibold text-white mb-2">3. Human Review</h3>
                                <p>Editorial review ensures quality before publication to the archive.</p>
                            </div>
                        </div>
                    </section>

                    {/* What We Track */}
                    <section className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl">
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                            <BarChart3 className="w-6 h-6 text-cyan-400" />
                            What We Track
                        </h2>
                        <ul className="grid grid-cols-2 gap-3 text-gray-300">
                            <li>• Parliament Bills</li>
                            <li>• Federal Politics</li>
                            <li>• Policy Changes</li>
                            <li>• Media Narratives</li>
                            <li>• Political Statements</li>
                            <li>• Legislative Activity</li>
                        </ul>
                    </section>

                    {/* For Creators */}
                    <section className="p-6 bg-purple-500/5 border border-purple-500/20 rounded-2xl">
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                            <Video className="w-6 h-6 text-purple-400" />
                            For Content Creators
                        </h2>
                        <p className="text-gray-300 leading-relaxed">
                            CANOPTICON helps content creators identify high-impact political stories for TikTok, YouTube, and other platforms.
                            Our AI generates video scripts, talking points, and strategic angles based on deep analysis of bias, rhetoric, and fallacies.
                        </p>
                    </section>

                    {/* Contact */}
                    <section className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl text-center">
                        <p className="text-gray-400">
                            CANOPTICON is in active development.
                        </p>
                    </section>
                </div>
            </div>
        </main>
    )
}
