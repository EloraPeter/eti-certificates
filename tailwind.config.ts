import type { Config } from "tailwindcss";

// Brand tokens match ETI-cohort's tailwind.config.ts exactly, so
// certificates and the marketing/portal site are visually
// consistent even though the two are separate codebases.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          900: "#0F172A", // Navy
        },
        brand: {
          royal: "#1D4ED8",
          gold: "#F59E0B",
          sky: "#38BDF8",
        },
      },
      fontFamily: {
        sora: ["Sora", "sans-serif"],
        sans: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
