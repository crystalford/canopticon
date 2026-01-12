"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion } from "framer-motion"
import { LayoutDashboard, Radio, FileText, Info, Inbox, Settings } from "lucide-react"

type CurrentPage = 'home' | 'dashboard' | 'archive' | 'about' | 'review' | 'sources';

export default function Navigation({ currentPage }: { currentPage: CurrentPage }) {
  const pathname = usePathname();

  const navLinks = [
    { name: 'Dashboard', href: '/admin/dashboard', id: 'dashboard', icon: LayoutDashboard },
    { name: 'Review Wire', href: '/admin/review/pending', id: 'review', icon: Inbox },
    { name: 'Sources', href: '/admin/sources', id: 'sources', icon: Settings },
    { name: 'Archive', href: '/archive', id: 'archive', icon: FileText },
    { name: 'About', href: '/about', id: 'about', icon: Info },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-8 py-6 pointer-events-none">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        {/* Logo Area */}
        <Link href="/" className="pointer-events-auto flex items-center gap-2 group">
          <div className="relative w-10 h-10 flex items-center justify-center bg-black/50 backdrop-blur-xl border border-white/10 rounded-xl group-hover:border-cyan-500/50 transition-colors">
            <Radio className="w-5 h-5 text-cyan-400 group-hover:text-cyan-300 transition-colors" />
          </div>
          <span className="font-bold tracking-tight text-white/80 group-hover:text-white transition-colors">
            CANOPTICON
          </span>
        </Link>

        {/* Dynamic Navigation Pill */}
        <div className="pointer-events-auto bg-black/50 backdrop-blur-2xl border border-white/10 rounded-full p-1.5 flex gap-1 shadow-2xl">
          {navLinks.map((link) => {
            const isActive = currentPage === link.id;
            const Icon = link.icon;

            return (
              <Link
                key={link.id}
                href={link.href}
                className={`
                  relative px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200
                  flex items-center gap-2
                  ${isActive ? 'text-black' : 'text-gray-400 hover:text-white hover:bg-white/5'}
                `}
              >
                {isActive && (
                  <motion.div
                    layoutId="activePill"
                    className="absolute inset-0 bg-white rounded-full"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  {/* Only show icon if not active or show both? Design choice. Let's show text. */}
                  {link.name}
                </span>
              </Link>
            )
          })}
        </div>

        {/* Right Area (Auth/Actions) */}
        <div className="pointer-events-auto flex gap-4">
          {/* Auth handled layout side or separate button */}
        </div>
      </div>
    </nav>
  )
}
