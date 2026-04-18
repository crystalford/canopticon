import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        void:     '#080a0f',
        base:     '#0d1117',
        raised:   '#141b24',
        overlay:  '#1a2332',
        signal:   '#e8a020',
        'signal-dim': '#9a6a15',
        confirmed: '#3dd68c',
        contested: '#e8a020',
        hypothesis: '#4da6ff',
        disputed:  '#ff4d4d',
        brand:     '#e63946',
      },
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
        body:    ['Libre Baskerville', 'serif'],
      },
      animation: {
        'scan': 'scan 8s linear infinite',
        'pulse-amber': 'pulseAmber 2s ease-in-out infinite',
        'tick': 'tick 0.3s ease-out',
      },
      keyframes: {
        scan: {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        pulseAmber: {
          '0%, 100%': { opacity: '0.18' },
          '50%':      { opacity: '0.5' },
        },
        tick: {
          '0%':   { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
