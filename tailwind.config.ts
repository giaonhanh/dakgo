import type { Config } from "tailwindcss"

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          primary:   "var(--bg-primary)",
          secondary: "var(--bg-secondary)",
          tertiary:  "var(--bg-tertiary)",
        },
        acc: {
          DEFAULT: "var(--acc)",
          mid:     "var(--acc-mid)",
          light:   "var(--acc-light)",
        },
        brand: {
          green:  "var(--green)",
          red:    "var(--red)",
          blue:   "var(--blue)",
          purple: "var(--purple)",
          yellow: "var(--yellow)",
        },
        text: {
          primary:   "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted:     "var(--text-muted)",
        },
      },
      fontFamily: {
        sans: ["Lexend", "Inter", "sans-serif"],
      },
      borderRadius: {
        "4xl": "2rem",
      },
      boxShadow: {
        acc:    "0 4px 20px rgba(255,107,0,0.4)",
        "acc-sm": "0 2px 10px rgba(255,107,0,0.3)",
      },
    },
  },
  plugins: [],
}

export default config
