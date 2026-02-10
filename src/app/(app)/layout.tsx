import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { ConversationSidebar } from '@/components/chat/ConversationSidebar'

export const metadata = {
    title: 'Dashboard | CANOPTICON',
}

export default async function AppLayout({
    children,
}: {
    children: React.ReactNode
}) {
    // Auth check
    const session = await getServerSession()
    if (!session) {
        redirect('/login')
    }

    return (
        <div className="flex h-screen w-full bg-[#050505] text-slate-200">
            {/* Fixed Sidebar */}
            <ConversationSidebar />

            {/* Main Content Area */}
            <main className="flex-1 min-w-0 overflow-y-auto relative">
                {children}
            </main>
        </div>
    )
}
