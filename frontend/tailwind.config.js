/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#020406"",       // primary dark background — dusk, not black
        paper: "#F7F5F1",     // warm light surface
        amber: "#f6861e",     // "stage ahead" signal — porch-light warmth
        sage: "5B7065",      // resolved / calm accent
        slate: "#8B93A6",     // muted text, metadata, trail markers
        inkmuted: "#1f1f20",  // slightly lighter than ink, for cards on dark bg
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        body: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-jbmono)", "monospace"],
      },
      keyframes: {
        pulseglow: {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
        fadeup: {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        pulseglow: "pulseglow 2.6s ease-in-out infinite",
        fadeup: "fadeup 0.5s ease-out both",
      },
    },
  },
  plugins: [],
};
