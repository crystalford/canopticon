import Link from 'next/link'
import { Terminal } from 'lucide-react'

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#22c55e]">
      <header className="border-b border-[#22c55e]/20 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:text-[#22c55e]/80 transition-colors">
            <Terminal className="w-6 h-6" />
            <span className="text-xl font-mono">CANOPTICON</span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/" className="text-sm font-mono hover:text-[#22c55e]/80 transition-colors">
              HOME
            </Link>
            <Link href="/admin/dashboard" className="text-sm font-mono hover:text-[#22c55e]/80 transition-colors">
              MISSION CONTROL
            </Link>
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}
