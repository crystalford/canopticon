import { supabase } from '@/lib/db'
import { approveSignal, deleteSignal } from '@/app/simple-actions'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function ReviewCard({ signal }: { signal: any }) {
    'use client'

    return (
        <div className="border border-gray-800 rounded-lg p-6 bg-gray-900/50">
            <h3 className="text-xl font-bold mb-2">{signal.headline}</h3>
            <p className="text-gray-400 text-sm mb-4">{signal.summary?.substring(0, 200)}...</p>

            <div className="flex gap-3">
                <form action={async () => {
                    'use server'
                    await approveSignal(signal.id)
                }}>
                    <button className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded">
                        Approve
                    </button>
                </form>

                <form action={async () => {
                    'use server'
                    await deleteSignal(signal.id)
                }}>
                    <button className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded">
                        Delete
                    </button>
                </form>
            </div>

            <div className="mt-4 text-xs text-gray-600">
                <a href={signal.url} target="_blank" className="hover:text-blue-400">
                    {signal.url}
                </a>
            </div>
        </div>
    )
}

export default async function ReviewPage() {
    const { data: signals, error } = await supabase
        .from('signals')
        .select('*')
        .eq('status', 'pending')
        .order('published_at', { ascending: false })
        .limit(50)

    if (error) {
        return <div className="p-8 text-red-500">Error: {error.message}</div>
    }

    return (
        <main className="min-h-screen bg-black text-white p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold mb-8">Review Queue</h1>

                {!signals || signals.length === 0 ? (
                    <div className="text-center text-gray-500 py-12">
                        No pending signals
                    </div>
                ) : (
                    <div className="space-y-4">
                        {signals.map((signal) => (
                            <ReviewCard key={signal.id} signal={signal} />
                        ))}
                    </div>
                )}
            </div>
        </main>
    )
}
