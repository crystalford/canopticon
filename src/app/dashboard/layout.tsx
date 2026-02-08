import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'

export const metadata = {
    title: 'Dashboard | CANOPTICON',
}

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const session = await getServerSession()

    if (!session) {
        redirect('/login')
    }

    return <>{children}</>
}
