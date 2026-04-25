import type { Config } from "tailwindcss";

// Design tokens trace the v9.2 operator prototype: dark amber-on-black with
// signal accents (red/sage/blue/tan) and cream highlights. The exact hex
// values come from docs/canopticon-prototype-v92.html and are mirrored here
// so Tailwind utilities and raw CSS reach them by the same names.

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#0a0a0b",
          deeper: "#050506",
          dim: "#16161a",
        },
        cream: {
          DEFAULT: "#f5e9d3",
          dim: "#d6cab2",
          faint: "#85785f",
        },
        amber: {
          DEFAULT: "#e8a838",
          deep: "#b87f1c",
          dim: "#7d5612",
        },
        signal: {
          red: "#c44545",
          sage: "#8aa67a",
          blue: "#5a82a8",
          tan: "#c9a97a",
        },
      },
      fontFamily: {
        serif: ["var(--font-serif)", "EB Garamond", "Georgia", "serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "ui-monospace", "monospace"],
      },
      borderRadius: {
        none: "0",
      },
    },
  },
  plugins: [],
};

export default config;
