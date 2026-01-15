import type { Config } from 'tailwindcss'

const config: Config = {
    darkMode: 'class', // We'll enforce dark mode essentially
    content: [
        './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            colors: {
                // Backgrounds
                background: {
                    DEFAULT: '#020617', // Slate 950+ (Almost black)
                    secondary: '#0f172a', // Slate 900
                },
                // Glass surfaces
                glass: {
                    100: 'rgba(255, 255, 255, 0.03)',
                    200: 'rgba(255, 255, 255, 0.05)',
                    300: 'rgba(255, 255, 255, 0.1)',
                },
                // Brand
                primary: {
                    400: '#f87171', // Red 400
                    500: '#ef4444', // Red 500
                    600: '#dc2626', // Red 600
                    glow: 'rgba(239, 68, 68, 0.5)',
                },
                accent: {
                    red: '#ef4444',
                }
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
            },
            boxShadow: {
                'glass': '0 4px 30px rgba(0, 0, 0, 0.1)',
                'neon': '0 0 10px rgba(14, 165, 233, 0.2), 0 0 20px rgba(14, 165, 233, 0.1)',
            },
            backgroundImage: {
                'glass-gradient': 'linear-gradient(145deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.01) 100%)',
            }
        },
    },
    plugins: [require('@tailwindcss/typography')],
}

export default config
