import { FeedsList } from '@/components/automations/FeedsList'

export default function FeedsPage() {
    return (
        <div className="max-w-5xl mx-auto py-12 px-6">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Pipelines</h1>
                <p className="text-slate-400">
                    Automated content pipelines — each one watches a source, runs through AI, and publishes.
                </p>
            </div>

            <FeedsList />
        </div>
    )
}
