import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'

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
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
            {/* Dashboard Header */}
            <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-4">
                            <Link href="/dashboard" className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center">
                                    <span className="text-white font-bold text-sm">C</span>
                                </div>
                                <span className="font-semibold text-lg">Dashboard</span>
                            </Link>
                        </div>

                        <nav className="flex items-center gap-6">
                            <Link
                                href="/dashboard"
                                className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors text-sm font-medium"
                            >
                                Daily Brief
                            </Link>
                            <Link
                                href="/dashboard/articles"
                                className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors text-sm font-medium"
                            >
                                Articles
                            </Link>
                            <Link
                                href="/dashboard/manual-sources"
                                className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors text-sm font-medium"
                            >
                                Manual Sources
                            </Link>
                            <Link
                                href="/dashboard/settings"
                                className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors text-sm font-medium"
                            >
                                Settings
                            </Link>
                            <Link
                                href="/"
                                className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors text-sm"
                            >
                                View Site →
                            </Link>
                        </nav>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {children}
            </main>
        </div>
    )
}
