import { supabase } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ContentPage() {
    const { data: signals, error } = await supabase
        .from('signals')
        .select('*')
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(100)

    if (error) {
        return <div className="p-8 text-red-500">Error: {error.message}</div>
    }

    return (
        <main className="min-h-screen bg-black text-white p-8">
            <div className="max-w-6xl mx-auto">
                <h1 className="text-3xl font-bold mb-8">Published Content</h1>

                {!signals || signals.length === 0 ? (
                    <div className="text-center text-gray-500 py-12">
                        No published content
                    </div>
                ) : (
                    <div className="space-y-2">
                        {signals.map((signal) => (
                            <div key={signal.id} className="border-b border-gray-800 py-4">
                                <h3 className="font-bold mb-1">{signal.headline}</h3>
                                <p className="text-sm text-gray-500">
                                    {new Date(signal.published_at).toLocaleDateString()}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </main>
    )
}
