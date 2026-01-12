"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion } from "framer-motion"
import { Radio, FileText, Info, Search } from "lucide-react"
import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs"

type CurrentPage = 'home' | 'archive' | 'about';

export default function PublicNavigation({ currentPage }: { currentPage: CurrentPage }) {
    const pathname = usePathname();

    const publicLinks = [
        { name: 'Home', href: '/', id: 'home', icon: Radio },
        { name: 'Stories', href: '/archive', id: 'archive', icon: FileText },
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

                {/* Public Navigation Pill */}
                <div className="pointer-events-auto bg-black/50 backdrop-blur-2xl border border-white/10 rounded-full p-1.5 flex gap-1 shadow-2xl">
                    {publicLinks.map((link) => {
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
                                        layoutId="publicActivePill"
                                        className="absolute inset-0 bg-white rounded-full"
                                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                    />
                                )}
                                <span className="relative z-10 flex items-center gap-2">
                                    <Icon className="w-4 h-4" />
                                    {link.name}
                                </span>
                            </Link>
                        )
                    })}
                </div>

                {/* Right Area - Auth */}
                <div className="pointer-events-auto flex items-center gap-4">
                    <SignedOut>
                        <SignInButton mode="modal">
                            <button className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-full text-sm font-medium transition-colors">
                                Sign In
                            </button>
                        </SignInButton>
                    </SignedOut>
                    <SignedIn>
                        <Link
                            href="/admin/dashboard"
                            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm text-gray-400 hover:text-white transition-colors"
                        >
                            Admin →
                        </Link>
                        <UserButton afterSignOutUrl="/" />
                    </SignedIn>
                </div>
            </div>
        </nav>
    )
}
