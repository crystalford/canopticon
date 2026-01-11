"use client"

import React from 'react'

interface LiquidChromeButtonProps {
  children: React.ReactNode
  href?: string
  onClick?: () => void
  className?: string
}

export default function LiquidChromeButton({ 
  children, 
  href, 
  onClick, 
  className = "" 
}: LiquidChromeButtonProps) {
  const baseClasses = "liquid-button relative px-6 py-2 rounded-full font-bold text-black overflow-hidden text-sm transition-transform active:scale-95"
  
  const content = (
    <>
      <span className="relative z-10">{children}</span>
      <div className="absolute inset-0 bg-white" />
      <div className="liquid-reflection absolute inset-0 bg-gradient-to-tr from-transparent via-white/80 to-transparent" />
    </>
  )

  if (href) {
    return (
      <a href={href} className={`${baseClasses} ${className}`}>
        {content}
      </a>
    )
  }

  return (
    <button onClick={onClick} className={`${baseClasses} ${className}`}>
      {content}
    </button>
  )
}
