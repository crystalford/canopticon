"use client"

import { SignInButton, SignOutButton, UserButton, useUser } from '@clerk/nextjs'
import { LogIn, LogOut } from 'lucide-react'

export default function AuthButton() {
  const { isSignedIn, isLoaded } = useUser()

  if (!isLoaded) {
    return (
      <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse" />
    )
  }

  if (isSignedIn) {
    return (
      <div className="flex items-center gap-3">
        <UserButton 
          appearance={{
            elements: {
              avatarBox: "w-8 h-8",
            }
          }}
        />
        <SignOutButton>
          <button className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-2">
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </SignOutButton>
      </div>
    )
  }

  return (
    <SignInButton mode="modal">
      <button className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-2">
        <LogIn className="w-4 h-4" />
        Sign In
      </button>
    </SignInButton>
  )
}
