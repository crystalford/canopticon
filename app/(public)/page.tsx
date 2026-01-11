"use client"; // CRITICAL: This line fixes the 'client-only' error you saw in Vercel

import React from 'react';
import LiquidChromeButton from '@/components/LiquidChromeButton';

export default function Home() {
  return (
    <main className="min-h-screen bg-[#050505] text-white selection:bg-cyan-500/30">
      {/* Background Glows for Depth */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-900/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[10%] right-[-5%] w-[30%] h-[30%] bg-purple-900/10 blur-[100px] rounded-full" />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 flex justify-between items-center px-8 py-6 backdrop-blur-md border-b border-white/5 bg-black/20">
        <a href="/" className="text-xl font-bold tracking-tighter uppercase hover:text-white transition-colors">Canopticon</a>
        <div className="flex gap-8 text-sm font-medium text-gray-400">
          <a href="/manifesto" className="hover:text-white transition-colors">Manifesto</a>
          <a href="/signals" className="hover:text-white transition-colors">Signals</a>
          <a href="/archive" className="hover:text-white transition-colors">Archive</a>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-44 pb-20 px-6 flex flex-col items-center justify-center text-center">
        {/* The "Crystal Ford" Glass Card */}
        <div className="max-w-4xl w-full p-12 rounded-[2.5rem] bg-white/[0.03] backdrop-blur-2xl border border-white/10 shadow-2xl relative overflow-hidden group">
          {/* Edge Highlight (Refraction) */}
          <div className="absolute inset-0 border border-white/10 rounded-[2.5rem] pointer-events-none group-hover:border-white/20 transition-colors" />
          
          <h1 className="text-6xl md:text-8xl font-bold tracking-tight mb-6 bg-gradient-to-b from-white to-gray-500 bg-clip-text text-transparent">
            The Digital <br /> Panopticon.
          </h1>
          
          <p className="text-lg text-gray-400 max-w-xl mx-auto mb-10 leading-relaxed">
            Monitoring industrial transformation and the evolution of Canadian infrastructure. High-fidelity research for the modern era.
          </p>

          {/* THE LIQUID CHROME BUTTON */}
          <LiquidChromeButton href="/signals" className="px-10 py-4">
            <span className="flex items-center gap-2">
              Enter the Signal
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-7-7 7 7-7 7"/></svg>
            </span>
          </LiquidChromeButton>
        </div>
      </section>
    </main>
  );
}