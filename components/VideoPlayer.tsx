'use client'

import { useState, useEffect, useRef } from 'react' // Added useRef
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Maximize2 } from 'lucide-react'
import { VideoScript, VideoScene } from '@/lib/content/video'

interface VideoPlayerProps {
    script: VideoScript;
    autoPlay?: boolean;
}

export default function VideoPlayer({ script, autoPlay = false }: VideoPlayerProps) {
    const [isPlaying, setIsPlaying] = useState(autoPlay)
    const [currentSceneIndex, setCurrentSceneIndex] = useState(0)
    const [progress, setProgress] = useState(0)
    const [isMuted, setIsMuted] = useState(false)

    // Flatten scenes for easier navigation
    // Intro -> Scenes -> Outro
    const timeline = [
        { type: 'intro', ...script.intro, duration: 3 }, // Default 3s for intro
        ...script.scenes.map(s => ({ type: 'scene', ...s, duration: 5 })), // Default 5s per scene
        { type: 'outro', ...script.outro, duration: 3 } // Default 3s for outro
    ]

    const currentScene = timeline[currentSceneIndex]
    const totalDuration = timeline.reduce((acc, s) => acc + s.duration, 0)

    useEffect(() => {
        let interval: NodeJS.Timeout
        if (isPlaying) {
            interval = setInterval(() => {
                setProgress(p => {
                    const nextProgress = p + 100 // 100ms ticks
                    const currentSceneDurationMs = currentScene.duration * 1000

                    // Check if scene is finished
                    // This is a simplified progress tracker. 
                    // In a real app we'd map global time to scene index.
                    // For this MVP, let's just use effect for scene switching? 
                    // Better: Just increment a global timer.
                    return nextProgress
                })
            }, 100)
        }
        return () => clearInterval(interval)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPlaying, currentScene])

    // Effect to handle scene transitions based on progress
    // Refactor: Let's use a simpler "Tick" approach.
    useEffect(() => {
        // Reset progress when scene changes? No, let's track LOCAL scene progress
    }, [currentSceneIndex])

    // Better implementation: A highly simplified "Slide Show" player
    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (isPlaying) {
            timer = setTimeout(() => {
                if (currentSceneIndex < timeline.length - 1) {
                    setCurrentSceneIndex(prev => prev + 1)
                } else {
                    setIsPlaying(false) // Stop at end
                    setCurrentSceneIndex(0) // Reset to start? Or stay at end. Let's reset.
                }
            }, currentScene.duration * 1000)
        }
        return () => clearTimeout(timer)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPlaying, currentSceneIndex])


    return (
        <div className="relative w-full aspect-[9/16] max-w-[300px] mx-auto bg-black rounded-3xl overflow-hidden shadow-2xl border-4 border-black group">

            {/* Screen Content */}
            <AnimatePresence mode='wait'>
                <motion.div
                    key={currentSceneIndex}
                    initial={{ opacity: 0, scale: 1.1 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                    className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center"
                >
                    {/* Background Gradient based on type */}
                    <div className={`absolute inset-0 opacity-50 ${currentScene.type === 'intro' ? 'bg-gradient-to-b from-blue-900 to-black' : currentScene.type === 'outro' ? 'bg-gradient-to-t from-purple-900 to-black' : 'bg-gray-900'}`} />

                    {/* Text Content */}
                    <div className="relative z-10 space-y-4">
                        <h3 className="text-xl font-black text-white uppercase tracking-tighter drop-shadow-lg">
                            {(currentScene as any).text_overlay || (currentScene as any).headline || "Scene"}
                        </h3>
                        <p className="text-sm text-gray-200 font-medium bg-black/50 p-2 rounded-lg backdrop-blur-sm">
                            {(currentScene as any).voiceover}
                        </p>
                    </div>

                    {/* Visual Cue (Placeholder for Visual Description) */}
                    <div className="absolute bottom-20 left-4 right-4 text-[10px] text-gray-500 text-center opacity-50">
                        Visual: {(currentScene as any).visual}
                    </div>

                </motion.div>
            </AnimatePresence>

            {/* UI Overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60 pointer-events-none" />

            {/* Progress Bar */}
            <div className="absolute top-2 left-2 right-2 flex gap-1 z-20">
                {timeline.map((_, idx) => (
                    <div key={idx} className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-white"
                            initial={{ width: '0%' }}
                            animate={{ width: idx < currentSceneIndex ? '100%' : idx === currentSceneIndex && isPlaying ? '100%' : '0%' }}
                            transition={{ duration: idx === currentSceneIndex && isPlaying ? timeline[idx].duration : 0, ease: "linear" }}
                        />
                    </div>
                ))}
            </div>

            {/* Controls */}
            <div className="absolute bottom-0 inset-x-0 p-4 flex items-center justify-center gap-6 z-20 pointer-events-auto">
                <button onClick={() => setCurrentSceneIndex(Math.max(0, currentSceneIndex - 1))} className="text-white/70 hover:text-white transition-colors">
                    <SkipBack className="w-5 h-5" />
                </button>

                <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 transition-transform active:scale-95"
                >
                    {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                </button>

                <button onClick={() => setCurrentSceneIndex(Math.min(timeline.length - 1, currentSceneIndex + 1))} className="text-white/70 hover:text-white transition-colors">
                    <SkipForward className="w-5 h-5" />
                </button>
            </div>

            {/* Title Tag */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-lg z-20">
                TIKTOK
            </div>

        </div>
    )
}
