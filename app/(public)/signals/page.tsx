import { getGlobalSignals } from '@/lib/ingestion'
import SignalCard from '@/components/SignalCard'
import Navigation from '@/components/Navigation'

export default async function PublicSignalsPage() {
    const allSignals = await getGlobalSignals();
    const signals = allSignals.filter(s => s.status === 'published');

    return (
        <div className="min-h-screen bg-[#050505] text-white">
            <Navigation currentPage="signals" />

            <div className="max-w-5xl mx-auto pt-32 px-4 pb-20">
                <div className="mb-12">
                    <h1 className="text-4xl font-bold mb-4 tracking-tight">Intercepted Signals</h1>
                    <p className="text-gray-400">Monitoring global frequencies for political narrative shifts.</p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    {signals.length === 0 ? (
                        <div className="p-12 border border-dashed border-white/10 rounded-xl text-center text-gray-500">
                            No signals currently intercepted. System scanning...
                        </div>
                    ) : (
                        signals.map((signal) => (
                            // Reusing SignalCard but maybe we want a read-only version later?
                            // For now, let's wrap it to disable the "Analyze" button or just let public click it (it won't save if no auth, or will error? Action is server side)
                            // Actually, the Action is public. We should probably restrict it to admin in the future.
                            // For MVP, letting public trigger AI is kinda cool (but expensive). 
                            // Let's assume we use the same card for now.
                            <SignalCard key={signal.id} signal={signal} />
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}
