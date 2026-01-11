"use client"

import Link from 'next/link'
import AuthButton from './AuthButton'
import { useUser } from '@clerk/nextjs'

interface NavigationProps {
  currentPage?: 'home' | 'manifesto' | 'signals' | 'archive' | 'dashboard'
}

export default function Navigation({ currentPage = 'home' }: NavigationProps) {
  const { isSignedIn } = useUser()

  return (
    <nav className="fixed top-0 w-full z-50 flex justify-between items-center px-8 py-6 backdrop-blur-md border-b border-white/5 bg-black/20">
      <Link href="/" className="text-xl font-bold tracking-tighter uppercase hover:text-white transition-colors">
        Canopticon
      </Link>
      <div className="flex items-center gap-8">
        <div className="flex gap-8 text-sm font-medium text-gray-400">
          {isSignedIn && (
            <Link
              href="/admin/dashboard"
              className={currentPage === 'dashboard' ? 'text-white' : 'text-cyan-400 hover:text-cyan-300 transition-colors'}
            >
              Dashboard
            </Link>
          )}
          <Link
            href="/manifesto"
            className={currentPage === 'manifesto' ? 'text-white' : 'hover:text-white transition-colors'}
          >
            Manifesto
          </Link>
          <Link
            href="/signals"
            className={currentPage === 'signals' ? 'text-white' : 'hover:text-white transition-colors'}
          >
            Signals
          </Link>
          <Link
            href="/archive"
            className={currentPage === 'archive' ? 'text-white' : 'hover:text-white transition-colors'}
          >
            Archive
          </Link>
        </div>
        <div className="border-l border-white/10 pl-8">
          <AuthButton />
        </div>
      </div>
    </nav>
  )
}
