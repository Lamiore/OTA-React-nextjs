import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)'],
        serif: ['var(--font-serif)'],
      },
      // Colors are backed by CSS variables (channel triplets) so a single
      // `.dark` class swap re-themes the whole app. `<alpha-value>` keeps the
      // `/opacity` modifier working (e.g. `bg-surface/70`).
      colors: {
        shore: {
          50: 'rgb(var(--c-shore-50) / <alpha-value>)',
          100: 'rgb(var(--c-shore-100) / <alpha-value>)',
          200: 'rgb(var(--c-shore-200) / <alpha-value>)',
          300: 'rgb(var(--c-shore-300) / <alpha-value>)',
        },
        teal: {
          50: 'rgb(var(--c-teal-50) / <alpha-value>)',
          100: 'rgb(var(--c-teal-100) / <alpha-value>)',
          200: 'rgb(var(--c-teal-200) / <alpha-value>)',
          400: 'rgb(var(--c-teal-400) / <alpha-value>)',
          500: 'rgb(var(--c-teal-500) / <alpha-value>)',
          600: 'rgb(var(--c-teal-600) / <alpha-value>)',
          700: 'rgb(var(--c-teal-700) / <alpha-value>)',
        },
        navy: {
          DEFAULT: 'rgb(var(--c-navy) / <alpha-value>)',
          light: 'rgb(var(--c-navy-light) / <alpha-value>)',
          soft: 'rgb(var(--c-navy-soft) / <alpha-value>)',
        },
        seafoam: 'rgb(var(--c-seafoam) / <alpha-value>)',
        // Themed surface (white in light, dark slate in dark).
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        // Always-dark color for overlays/scrims over photos and the brand mark
        // — must NOT flip with the theme.
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        soft: '0 1px 3px rgba(15, 43, 60, 0.04), 0 8px 24px rgba(15, 43, 60, 0.06)',
        lift: '0 4px 12px rgba(15, 43, 60, 0.06), 0 20px 48px rgba(15, 43, 60, 0.08)',
        glow: '0 0 0 1px rgba(27, 138, 143, 0.12), 0 8px 24px rgba(27, 138, 143, 0.1)',
      },
    },
  },
  plugins: [],
};
export default config;
