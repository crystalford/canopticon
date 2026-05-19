import type { Config } from "tailwindcss";

// Token names map to CSS variables in src/app/globals.css. Keep this map
// in lock-step with that file — when you add a new token, add it both
// places. Utility classes use `var(--color-foo)` so the actual color
// values live in one place.
const colorVar = (name: string) => `var(--color-${name})`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: colorVar("bg"),
          deeper: colorVar("bg-deeper"),
          elevated: colorVar("bg-elevated"),
          subtle: colorVar("bg-subtle"),
          card: colorVar("bg-card"),
        },
        border: {
          DEFAULT: colorVar("border"),
          soft: colorVar("border-soft"),
          bright: colorVar("border-bright"),
        },
        text: {
          DEFAULT: colorVar("text"),
          dim: colorVar("text-dim"),
          faint: colorVar("text-faint"),
        },
        cream: {
          DEFAULT: colorVar("cream"),
          dim: colorVar("cream-dim"),
          bright: colorVar("cream-bright"),
        },
        signal: {
          DEFAULT: colorVar("signal"),
          dim: colorVar("signal-dim"),
        },
        amber: {
          DEFAULT: colorVar("amber"),
          dim: colorVar("amber-dim"),
          bright: colorVar("amber-bright"),
        },
        sage: {
          DEFAULT: colorVar("sage"),
          dim: colorVar("sage-dim"),
        },
        good: colorVar("good"),
        blue: {
          DEFAULT: colorVar("blue"),
          dim: colorVar("blue-dim"),
        },
        tan: {
          DEFAULT: colorVar("tan"),
          dim: colorVar("tan-dim"),
        },
      },
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "Geist",
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "sans-serif",
        ],
        // 'serif' kept pointing at Geist so legacy class names render
        // consistently after the rebrand. The editorial cream/serif look
        // is gone — everything is Geist now.
        serif: [
          "var(--font-sans)",
          "Geist",
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "sans-serif",
        ],
        mono: ["var(--font-mono)", "Geist Mono", "JetBrains Mono", "ui-monospace", "monospace"],
      },
      borderRadius: {
        none: "0",
      },
      letterSpacing: {
        widest: "0.14em",
      },
    },
  },
  plugins: [],
};

export default config;
