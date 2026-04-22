import { createClient } from '@/lib/supabase/server'
import ChannelManager from './ChannelManager'

export const dynamic = 'force-dynamic'

export default async function ChannelsPage() {
  const supabase = createClient()
  const { data: channels } = await supabase
    .from('watched_channels')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-display text-xl font-bold text-text-primary">Watched Channels</h1>
        <p className="font-mono text-xs text-text-muted mt-1">
          YouTube channels feeding the intelligence graph via PubSubHubbub webhooks.
          New videos are automatically pushed to the intake queue.
        </p>
      </div>

      <ChannelManager initialChannels={channels ?? []} />
    </div>
  )
}
