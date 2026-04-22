'use client'

import { useState } from 'react'
import { Rss, Plus, Trash2, ToggleLeft, ToggleRight, Loader2, CheckCircle, XCircle, Clock } from 'lucide-react'

interface WatchedChannel {
  id: string
  channel_id: string
  channel_name: string
  channel_url: string | null
  is_active: boolean
  webhook_subscribed: boolean
  webhook_expires_at: string | null
  last_video_id: string | null
  last_video_at: string | null
  videos_ingested: number
  created_at: string
}

export default function ChannelManager({ initialChannels }: { initialChannels: WatchedChannel[] }) {
  const [channels, setChannels] = useState<WatchedChannel[]>(initialChannels)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ channel_id: '', channel_name: '' })
  const [saving, setSaving] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function addChannel() {
    if (!form.channel_id.trim() || !form.channel_name.trim()) return
    setSaving(true)
    setError(null)

    const res = await fetch('/api/watched-channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Failed to add channel')
      setSaving(false)
      return
    }

    setChannels((prev) => [data, ...prev])
    setForm({ channel_id: '', channel_name: '' })
    setAdding(false)
    setSaving(false)
  }

  async function subscribe(id: string, action: 'subscribe' | 'unsubscribe') {
    setActionLoading(`${id}-${action}`)
    setError(null)

    const res = await fetch(`/api/watched-channels/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Webhook action failed')
    } else if (action === 'unsubscribe') {
      setChannels((prev) => prev.map((c) => c.id === id ? { ...c, webhook_subscribed: false, webhook_expires_at: null } : c))
    }

    setActionLoading(null)
  }

  async function toggleActive(id: string, is_active: boolean) {
    setActionLoading(`${id}-toggle`)

    const res = await fetch(`/api/watched-channels/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !is_active }),
    })
    if (res.ok) {
      setChannels((prev) => prev.map((c) => c.id === id ? { ...c, is_active: !is_active } : c))
    }

    setActionLoading(null)
  }

  async function deleteChannel(id: string) {
    if (!confirm('Remove this channel? Webhook will be unsubscribed.')) return
    setActionLoading(`${id}-delete`)

    await fetch(`/api/watched-channels/${id}`, { method: 'DELETE' })
    setChannels((prev) => prev.filter((c) => c.id !== id))
    setActionLoading(null)
  }

  const webhookStatus = (channel: WatchedChannel) => {
    if (!channel.webhook_subscribed) return { icon: <XCircle size={12} />, label: 'Not subscribed', color: 'text-text-muted' }
    if (channel.webhook_expires_at) {
      const expires = new Date(channel.webhook_expires_at)
      const daysLeft = Math.ceil((expires.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      if (daysLeft <= 2) return { icon: <Clock size={12} />, label: `Expires in ${daysLeft}d`, color: 'text-disputed' }
      return { icon: <CheckCircle size={12} />, label: `Active · ${daysLeft}d left`, color: 'text-confirmed' }
    }
    return { icon: <Clock size={12} />, label: 'Verifying...', color: 'text-hypothesis' }
  }

  return (
    <div className="space-y-4">
      {/* Add channel form */}
      {adding ? (
        <div className="glass-panel p-4 space-y-3">
          <p className="font-mono text-xs text-text-muted">Add YouTube channel</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-mono text-xs text-text-muted block mb-1">Channel ID</label>
              <input
                className="input-field w-full"
                placeholder="UCxxxxxxxxxxxxxxxx"
                value={form.channel_id}
                onChange={(e) => setForm((f) => ({ ...f, channel_id: e.target.value }))}
              />
              <p className="font-mono text-[10px] text-text-muted mt-1">From the channel URL or About page</p>
            </div>
            <div>
              <label className="font-mono text-xs text-text-muted block mb-1">Display name</label>
              <input
                className="input-field w-full"
                placeholder="Moose on the Loose"
                value={form.channel_name}
                onChange={(e) => setForm((f) => ({ ...f, channel_name: e.target.value }))}
              />
            </div>
          </div>
          {error && <p className="font-mono text-xs text-disputed">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={addChannel}
              disabled={saving || !form.channel_id.trim() || !form.channel_name.trim()}
              className="btn-primary px-4 py-2 font-mono text-xs disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : null}
              Add channel
            </button>
            <button
              onClick={() => { setAdding(false); setError(null); setForm({ channel_id: '', channel_name: '' }) }}
              className="font-mono text-xs px-4 py-2 rounded-sm border border-border text-text-muted hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 font-mono text-xs px-3 py-2 rounded-sm border border-dashed border-border text-text-muted hover:border-signal/40 hover:text-signal transition-colors"
        >
          <Plus size={12} /> Add channel
        </button>
      )}

      {error && !adding && <p className="font-mono text-xs text-disputed">{error}</p>}

      {/* Channel list */}
      {channels.length === 0 ? (
        <div className="glass-panel p-8 text-center font-mono text-xs text-text-muted">
          No channels watched yet. Add a YouTube channel ID to start receiving video notifications.
        </div>
      ) : (
        <div className="space-y-2">
          {channels.map((channel) => {
            const status = webhookStatus(channel)
            const isLoading = actionLoading?.startsWith(channel.id)

            return (
              <div key={channel.id} className={`glass-panel p-4 ${!channel.is_active ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <a
                        href={channel.channel_url ?? `https://www.youtube.com/channel/${channel.channel_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-display text-sm text-text-primary hover:text-signal transition-colors"
                      >
                        {channel.channel_name}
                      </a>
                      {!channel.is_active && (
                        <span className="font-mono text-[10px] text-text-muted border border-border px-1.5 py-0.5 rounded-sm">paused</span>
                      )}
                    </div>
                    <p className="font-mono text-[10px] text-text-muted mt-0.5">{channel.channel_id}</p>

                    <div className="flex items-center gap-4 mt-2 flex-wrap">
                      <span className={`flex items-center gap-1 font-mono text-[10px] ${status.color}`}>
                        {status.icon} {status.label}
                      </span>
                      <span className="font-mono text-[10px] text-text-muted">
                        {channel.videos_ingested} videos ingested
                      </span>
                      {channel.last_video_at && (
                        <span className="font-mono text-[10px] text-text-muted">
                          Last: {new Date(channel.last_video_at).toLocaleDateString('en-CA')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {!channel.webhook_subscribed ? (
                      <button
                        onClick={() => subscribe(channel.id, 'subscribe')}
                        disabled={!!actionLoading}
                        className="flex items-center gap-1.5 font-mono text-xs px-3 py-1.5 rounded-sm border border-signal/30 text-signal hover:bg-signal/10 transition-colors disabled:opacity-50"
                      >
                        {actionLoading === `${channel.id}-subscribe`
                          ? <Loader2 size={12} className="animate-spin" />
                          : <Rss size={12} />}
                        Subscribe
                      </button>
                    ) : (
                      <button
                        onClick={() => subscribe(channel.id, 'unsubscribe')}
                        disabled={!!actionLoading}
                        className="flex items-center gap-1.5 font-mono text-xs px-3 py-1.5 rounded-sm border border-border text-text-muted hover:border-disputed/40 hover:text-disputed transition-colors disabled:opacity-50"
                      >
                        {actionLoading === `${channel.id}-unsubscribe`
                          ? <Loader2 size={12} className="animate-spin" />
                          : <Rss size={12} />}
                        Unsubscribe
                      </button>
                    )}

                    <button
                      onClick={() => toggleActive(channel.id, channel.is_active)}
                      disabled={!!actionLoading}
                      title={channel.is_active ? 'Pause channel' : 'Resume channel'}
                      className="text-text-muted hover:text-signal transition-colors disabled:opacity-50"
                    >
                      {isLoading && actionLoading === `${channel.id}-toggle`
                        ? <Loader2 size={16} className="animate-spin" />
                        : channel.is_active
                          ? <ToggleRight size={16} className="text-confirmed" />
                          : <ToggleLeft size={16} />}
                    </button>

                    <button
                      onClick={() => deleteChannel(channel.id)}
                      disabled={!!actionLoading}
                      title="Remove channel"
                      className="text-text-muted hover:text-disputed transition-colors disabled:opacity-50"
                    >
                      {actionLoading === `${channel.id}-delete`
                        ? <Loader2 size={14} className="animate-spin" />
                        : <Trash2 size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
