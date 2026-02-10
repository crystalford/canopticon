import { FeedsList } from '@/components/automations/FeedsList'

export default function FeedsPage() {
    return (
        <div className="max-w-4xl mx-auto py-12 px-6">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Live Feeds</h1>
                <p className="text-slate-400">
                    Manage your active content sources and webhooks.
                </p>
            </div>

            <FeedsList />
        </div>
    )
}
