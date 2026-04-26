/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0b0d10",
          soft: "#13171c",
          card: "#1a1f26",
          hover: "#222831",
        },
        border: "#2a3038",
        accent: "var(--accent, #FF6B1A)",
        ink: {
          DEFAULT: "#e6e8eb",
          muted: "#9aa3ad",
          dim: "#5b636d",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
