import type { Config } from "tailwindcss";

/* Hallmark · design-system: design.md · designed-as-app
 * Every scale below reads from tokens.css, so Tailwind utilities and plain CSS
 * resolve to the same numbers — there is no second source of truth. */
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
      // The type scale from design.md. Redefining the ramp is the point: it
      // makes an off-scale size impossible to express as a utility class.
      fontSize: {
        '2xs': ['var(--text-2xs)', { lineHeight: '1.4' }],
        xs: ['var(--text-xs)', { lineHeight: '1.45' }],
        sm: ['var(--text-sm)', { lineHeight: '1.55' }],
        base: ['var(--text-base)', { lineHeight: '1.6' }],
        md: ['var(--text-md)', { lineHeight: '1.6' }],
        lg: ['var(--text-lg)', { lineHeight: '1.3' }],
        xl: ['var(--text-xl)', { lineHeight: '1.2' }],
        '2xl': ['var(--text-2xl)', { lineHeight: '1.1' }],
        '3xl': ['var(--text-3xl)', { lineHeight: '1.05' }],
        display: ['var(--text-display)', { lineHeight: '1.03', letterSpacing: '-0.02em' }],
      },
      // Colors are backed by OKLCH channel triplets so a single `.dark` class
      // swap re-themes the whole app. `<alpha-value>` keeps the `/opacity`
      // modifier working (e.g. `bg-surface/70`).
      colors: {
        shore: {
          50: 'oklch(var(--c-shore-50) / <alpha-value>)',
          100: 'oklch(var(--c-shore-100) / <alpha-value>)',
          200: 'oklch(var(--c-shore-200) / <alpha-value>)',
          300: 'oklch(var(--c-shore-300) / <alpha-value>)',
        },
        teal: {
          50: 'oklch(var(--c-teal-50) / <alpha-value>)',
          100: 'oklch(var(--c-teal-100) / <alpha-value>)',
          200: 'oklch(var(--c-teal-200) / <alpha-value>)',
          400: 'oklch(var(--c-teal-400) / <alpha-value>)',
          500: 'oklch(var(--c-teal-500) / <alpha-value>)',
          600: 'oklch(var(--c-teal-600) / <alpha-value>)',
          700: 'oklch(var(--c-teal-700) / <alpha-value>)',
        },
        navy: {
          DEFAULT: 'oklch(var(--c-navy) / <alpha-value>)',
          light: 'oklch(var(--c-navy-light) / <alpha-value>)',
          soft: 'oklch(var(--c-navy-soft) / <alpha-value>)',
          subtle: 'oklch(var(--c-navy-subtle) / <alpha-value>)',
        },
        seafoam: 'oklch(var(--c-seafoam) / <alpha-value>)',
        // Status. Use these instead of Tailwind's built-in red/amber/green/blue:
        // those are fixed values and stay light when the page goes dark.
        danger: {
          DEFAULT: 'oklch(var(--c-danger) / <alpha-value>)',
          soft: 'oklch(var(--c-danger-soft) / <alpha-value>)',
          rule: 'oklch(var(--c-danger-rule) / <alpha-value>)',
        },
        warn: {
          DEFAULT: 'oklch(var(--c-warn) / <alpha-value>)',
          soft: 'oklch(var(--c-warn-soft) / <alpha-value>)',
          rule: 'oklch(var(--c-warn-rule) / <alpha-value>)',
        },
        ok: {
          DEFAULT: 'oklch(var(--c-ok) / <alpha-value>)',
          soft: 'oklch(var(--c-ok-soft) / <alpha-value>)',
        },
        info: {
          DEFAULT: 'oklch(var(--c-info) / <alpha-value>)',
          soft: 'oklch(var(--c-info-soft) / <alpha-value>)',
        },
        star: 'oklch(var(--c-star) / <alpha-value>)',
        // Themed card face (tinted near-white in light, dark slate in dark).
        surface: 'oklch(var(--c-surface) / <alpha-value>)',
        // Always-dark color for scrims over photos and the brand mark — must
        // NOT flip with the theme.
        ink: 'oklch(var(--c-ink) / <alpha-value>)',
      },
      // One radius per role. `pill` is for filter chips and avatars only.
      borderRadius: {
        xs: 'var(--radius-xs)',
        sm: 'var(--radius-sm)',
        DEFAULT: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        pill: 'var(--radius-pill)',
      },
      // Elevation is for things that float. Cards use a hairline instead.
      boxShadow: {
        float: 'var(--shadow-float)',
        overlay: 'var(--shadow-overlay)',
      },
      transitionTimingFunction: {
        out: 'var(--ease-out)',
        in: 'var(--ease-in)',
        'in-out': 'var(--ease-in-out)',
      },
      transitionDuration: {
        micro: '120ms',
        short: '220ms',
        long: '420ms',
      },
    },
  },
  plugins: [],
};
export default config;
