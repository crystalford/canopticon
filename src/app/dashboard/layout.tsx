import Link from 'next/link'
// import { redirect } from 'next/navigation'
// import { getServerSession } from 'next-auth'

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    // Auth temporarily disabled
    // const session = await getServerSession()
    // if (!session) {
    //     redirect('/login')
    // }

    return (
        <div className="min-h-screen bg-black text-white">
            {/* Header */}
            <header className="border-b border-white/10 bg-black/50 backdrop-blur">
                <div className="max-w-screen-2xl mx-auto px-6 h-16 flex items-center justify-between">
                    <Link href="/" className="text-xl font-bold text-primary-500">
                        CANOPTICON
                    </Link>
                    <nav className="flex items-center gap-6 text-sm">
                        <Link
                            href="/dashboard/ai-providers"
                            className="hover:text-primary-400 transition-colors"
                        >
                            AI Providers
                        </Link>
                        <Link
                            href="/dashboard/prompts"
                            className="hover:text-primary-400 transition-colors"
                        >
                            Prompts
                        </Link>
                    </nav>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-screen-2xl mx-auto px-6 py-8">
                {children}
            </main>
        </div>
    )
}
