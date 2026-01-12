export const dynamic = 'force-dynamic'

import { supabaseAdmin } from '@/lib/supabase-admin'
import CMSDashboard from '@/components/CMSDashboard'
import Navigation from '@/components/Navigation'
import { isUserAdmin } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function AdminDashboard() {
  const isAdmin = await isUserAdmin();
  if (!isAdmin) redirect('/');

  // Fetch real-time stats
  // We can fetch summary counts from DB
  const { data: signals } = await supabaseAdmin
    .from('signals')
    .select('id, status, created_at')
    .order('created_at', { ascending: false })
    .limit(1000); // Limit provided to avoid massive fetch, but enough for stats

  // Calculate real-time stats
  const total = signals?.length || 0;
  // @ts-ignore
  const pending = signals?.filter((s: any) => s.status === 'pending').length || 0;
  // @ts-ignore
  const published = signals?.filter((s: any) => ['published', 'approved', 'flagged'].includes(s.status)).length || 0;

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <Navigation currentPage="dashboard" />
      <div className="pt-24 p-8 max-w-[1600px] mx-auto">
        <CMSDashboard
          stats={{
            totalSignals: total,
            pendingTriage: pending,
            published: published,
            systemHealth: 98 // detailed health check later
          }}
        />
      </div>
    </main>
  )
}