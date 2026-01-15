import React from 'react'

export default function Logo({ className = "", size = "md" }: { className?: string, size?: "sm" | "md" | "lg" }) {
    const sizeClasses = {
        sm: "w-6 h-6",
        md: "w-8 h-8",
        lg: "w-12 h-12"
    }

    const fontSize = {
        sm: "text-md",
        md: "text-lg",
        lg: "text-2xl"
    }

    return (
        <div className={`flex items-center gap-3 group ${className}`}>
            <div className={`relative ${sizeClasses[size]} rounded-full bg-black border-2 border-slate-700 shadow-lg flex items-center justify-center overflow-hidden`}>
                {/* Metallic rim reflection */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-slate-800 via-transparent to-white/20" />

                {/* The Red Lens */}
                <div className="absolute inset-1 rounded-full bg-gradient-to-br from-red-600 to-red-900 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]">
                    {/* Inner detailed lens reflections */}
                    <div className="absolute inset-[20%] rounded-full bg-gradient-to-t from-black to-red-950/80" />
                    <div className="absolute top-[15%] left-[20%] w-[20%] h-[10%] bg-white/40 blur-[1px] rounded-[50%] transform -rotate-45" />
                    <div className="absolute bottom-[20%] right-[20%] w-[10%] h-[10%] bg-red-500/50 blur-[2px] rounded-full" />
                </div>

                {/* Activity Glow */}
                <div className="absolute inset-0 rounded-full shadow-[0_0_15px_2px_rgba(239,68,68,0.4)] group-hover:shadow-[0_0_25px_4px_rgba(239,68,68,0.6)] transition-all duration-500" />
            </div>

            <span className={`font-bold tracking-widest text-white ${fontSize[size]} group-hover:text-red-400 transition-colors uppercase`}>
                <span className="text-slate-200">Can</span>
                <span className="text-red-500">opti</span>
                <span className="text-slate-200">con</span>
            </span>
        </div>
    )
}
