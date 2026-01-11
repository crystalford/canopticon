import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

const ALLOWED_EMAILS = ['chrisrobtelford@gmail.com']

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const user = await currentUser()

    if (!user) {
        redirect('/sign-in')
    }

    const email = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress || user.emailAddresses[0]?.emailAddress

    if (!email || !ALLOWED_EMAILS.includes(email)) {
        return (
            <div className="flex h-screen w-full flex-col items-center justify-center bg-black text-white">
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-12 text-center backdrop-blur-xl">
                    <h1 className="text-3xl font-bold text-red-500 mb-4">Access Restricted</h1>
                    <p className="text-gray-300">This frequency is encrypted.</p>
                    <p className="mt-4 text-sm text-gray-500 font-mono">
                        Identity: {email || 'Unknown'}
                    </p>
                </div>
            </div>
        )
    }

    return <>{children}</>
}
