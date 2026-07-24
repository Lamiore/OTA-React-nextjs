# Design — Lautara

A locked design system for this app. Every page redesign reads this file before
emitting code. Do not regenerate per page — extend or amend this file when the
system needs to grow.

Across pages of Lautara, **consistency is the goal, not variety**. Pages that
drift from this file are the slop this system exists to remove.

## Genre

**editorial.**

Lautara is a place-and-photography product: destinasi selam, foto laut, deskripsi
panjang, ulasan. That is editorial, not atmospheric. (A previous pass stamped
`atmospheric` on `beranda` — that was wrong. Atmospheric means dark paper and a
late-night register; Lautara is warm off-white with a classical serif.)

Consequences: hairlines over card borders, asymmetric layout, quiet motion,
photography carries the page, accent stays under 5% of any viewport.

## Macrostructure families

- **Marketing pages** (`/beranda`) — **Photographic**. The hero photo is the
  page's first argument; type sits on it, left-biased. Varies on: hero archetype,
  discovery band grouping.
- **App pages** (`/booking`, `/profile`, `/dashboard`) — **Workbench**. Function
  carries the page. Dense, left-aligned, no enrichment, no decorative motion.
  Varies on: panel arrangement, sidebar presence.
- **Content pages** (`/destinations/[id]`) — **Long Document**. Photo lede, then a
  single measured column of prose, price, monitoring, reviews. Varies on: which
  optional blocks render.

## Theme

Lautara — the existing brand, preserved and tokenized. Anchor hue is teal 193°;
neutrals are tinted **warm** (73–78°) on paper and **cool** (227–240°) on ink,
which is the existing brand's own contrast and is kept deliberately.

Light:

- `--color-paper`      oklch(98.0% 0.005 78)   /* #FAF8F5 */
- `--color-paper-2`    oklch(95.7% 0.008 74)   /* #F4F0EB */
- `--color-surface`    oklch(99.4% 0.003 78)   /* card face — tinted, never pure white */
- `--color-rule`       oklch(91.5% 0.014 78)   /* #E8E2D9 — hairlines */
- `--color-rule-2`     oklch(84.6% 0.018 73)   /* #D4CBC0 — hairline hover */
- `--color-ink`        oklch(27.6% 0.046 238)  /* #0F2B3C */
- `--color-muted`      oklch(52.0% 0.030 234)  /* #5C6F7A — 4.94:1, body-grade */
- `--color-subtle`     oklch(58.5% 0.026 233)  /* #6B7C86 — 4.08:1, large text only */
- `--color-accent`     oklch(49.5% 0.080 193)  /* #14706E — 5.55:1 on paper, 5.88:1 on white */
- `--color-accent-2`   oklch(57.8% 0.092 200)  /* #1B8A8F — borders, decoration, NOT text */
- `--color-accent-ink` oklch(99% 0.003 190)    /* near-white on accent fill, 5.8:1 */
- `--color-accent-soft`oklch(96.8% 0.011 190)  /* #EDF7F6 */
- `--color-focus`      oklch(49.5% 0.080 193)
- `--color-scrim`      oklch(27.6% 0.046 238)  /* always-dark, never flips with theme */

Dark (hue held constant; only L and C move):

- `--color-paper`      oklch(18.4% 0.016 227)  /* #0B1418 */
- `--color-paper-2`    oklch(23.3% 0.022 240)  /* #141F27 */
- `--color-surface`    oklch(23.3% 0.022 240)  /* elevation via lightness, not shadow */
- `--color-rule`       oklch(32.9% 0.027 227)
- `--color-ink`        oklch(95.1% 0.009 225)
- `--color-muted`      oklch(68.2% 0.025 232)  /* 5.89:1 on paper-2 */
- `--color-accent`     oklch(66.8% 0.103 197)  /* #2DA8AA — 5.81:1 */
- `--color-accent-ink` oklch(20.0% 0.030 195)  /* dark ink on light-teal fill, 5.91:1 */

**Contrast floor, enforced:** body text 4.5:1, large text and UI boundaries 3:1.
`--color-accent-2` and `--color-rule*` are decoration tokens — they may never
carry text.

## Typography

Preserved from the existing project (`next/font`, `app/layout.tsx`). Two families,
no outlier.

- Display: **Cormorant**, weight 300 / 600, `font-style: normal`
- Body: **Figtree**, weight 400 / 500 / 600
- Display tracking: `-0.02em`
- Display leading: 1.03–1.12. Body leading: 1.5–1.65.

**Headings are roman.** No italic display, ever — not even one emphasised word.
Emphasis is carried by weight or `--color-accent`.

### Scale — the only sizes on the site

Anchored at 16px body, ~1.25 in the display range, practical ramp below for app UI.
Nothing renders below 11px. No arbitrary `text-[Npx]` values, anywhere.

| Token | Value | Role |
| --- | --- | --- |
| `--text-2xs` | 0.6875rem / 11px | chips, meta, legal — never a sentence |
| `--text-xs` | 0.75rem / 12px | dense table cells, captions |
| `--text-sm` | 0.875rem / 14px | secondary body, UI labels — the floor for prose |
| `--text-base` | 1rem / 16px | body |
| `--text-md` | 1.125rem / 18px | lede paragraphs |
| `--text-lg` | 1.375rem / 22px | h4 / card titles |
| `--text-xl` | 1.75rem / 28px | h3 |
| `--text-2xl` | 2.25rem / 36px | h2 |
| `--text-3xl` | 2.75rem / 44px | section display |
| `--text-display` | clamp(2.5rem, 4.5vw + 1rem, 4.5rem) | page h1 |

Max five sizes per page. More hierarchy comes from weight and colour, not a
sixth size.

Tabular numerals (`font-variant-numeric: tabular-nums`) on every price, sensor
reading, statistic, and date column.

## Spacing

Tailwind's native 4-point scale. Not re-tokenized — the framework already ships
it and a parallel `--space-*` set would be a second source of truth.

Section rhythm varies deliberately: marketing sections breathe (`py-20`/`py-24`),
app panels are tight (`py-8`/`py-10`), content columns sit between. Every section
padded identically is its own tell.

## Radius

One radius per role, not one radius for everything. Seventy-four `rounded-full`
across the app was the uniform-radius tell.

- `--radius-xs` 4px — checkbox, tag, badge
- `--radius-sm` 6px — button, input, select
- `--radius-md` 10px — card, panel, price item
- `--radius-lg` 16px — modal, bottom sheet, hero sheet
- `--radius-pill` 9999px — **filter chips and avatars only**

## Motion

- Easings: `--ease-out` `cubic-bezier(0.16, 1, 0.3, 1)` (entering),
  `--ease-in` `cubic-bezier(0.7, 0, 0.84, 0)` (leaving),
  `--ease-in-out` `cubic-bezier(0.65, 0, 0.35, 1)` (toggles).
  The browser default `ease` is banned.
- Durations: `--dur-micro` 120ms, `--dur-short` 220ms, `--dur-long` 420ms.
- **Only `transform` and `opacity` animate.** `transition-all` is banned; name
  the properties.
- Reveal pattern: one orchestrated entrance per page load, staggered by DOM index,
  capped at 500ms total. Nothing reveals on scroll.
- **No parallax.** No `scroll` event listeners driving layout.
- Reduced-motion fallback: opacity-only, ≤150ms. Functional motion (skeletons,
  progress) keeps running.

## Microinteractions stance

- **Focus is non-negotiable.** Every interactive element ships
  `:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px }`.
  The ring appears **instantly** — never transitioned, never faded in.
- Silent success. Toasts only for failures and async effects the user can't see.
- Optimistic update + Undo over confirmation dialogs, except for irreversible
  destructive actions.
- Tooltip delay: 800ms on hover, 0ms on focus.
- One hover signal per element — a colour shift **or** a 1px lift, never both
  plus a shadow plus a scale.
- Skeletons over spinners wherever the layout is known.

## Surface language

- **Cards are hairline-on-paper, not floating rectangles.** Default card is
  `background: var(--color-surface)` + `1px solid var(--color-rule)` +
  `--radius-md`, **no shadow**.
- Shadow is reserved for things that genuinely float above the page: sticky nav,
  modal, dropdown, bottom sheet. In dark mode, elevation is carried by
  *lightness* (+3% per level), not shadow.
- **No card-in-card.** One containment layer per region. A description or a price
  list inside an already-bounded column does not get its own card.
- **No decorative blur orbs, no gradient mesh, no wave dividers.** Sections are
  separated by a hairline, a paper-tone change, or nothing.

## CTA voice

- **Primary** — `--color-accent` fill, `--color-accent-ink` label,
  `--radius-sm`, `font-weight: 600`, `--text-sm`. Hover: darken fill only.
  Press: `translateY(1px)`. No lift, no glow, no gradient.
- **Secondary** — transparent fill, `1px solid var(--color-rule)`,
  `--color-ink` label, `--radius-sm`. Hover: border to `--color-rule-2`.
- **Tertiary** — accent-coloured text with an underline drawn on hover. No box.
- Copy pattern: imperative Indonesian verb, ≤3 words. *Cari*, *Booking*,
  *Simpan*, *Lihat semua*. Never *"Klik di sini"*, never a sentence.

## Section heads

**Eyebrows are OFF.** No `01 · JELAJAHI`, no uppercase micro-label above a
heading, no `.section-label`. A section head is the heading, optionally followed
by one line of body copy. Nothing above it.

Never a tag-left / heading-right two-column head.

## Copy

Indonesian, specific, verbs over adjectives. Typographic punctuation only:
`—` not `--`, `…` not `...`, curly quotes.

**No invented numbers.** Every statistic on the site comes from Firestore or the
sensor feed, or it does not ship. A number-shaped hole is honest; a plausible
fabricated number is not.

## Per-page allowances

- Marketing pages MAY use photographic enrichment (real destination photos only).
- App pages MUST NOT use enrichment — function carries the page.
- Content pages: photo lede plus typography.
- **No page uses emoji as imagery.** Where a destination has no photo, render a
  typographic plate: destination initial set in Cormorant over a flat brand-tinted
  field. Emoji-as-art is an AI tell and renders differently on every device.

## What pages MUST share

- The Lautara wordmark and its mark.
- The accent colour and its budget (≤5% per viewport).
- Cormorant display + Figtree body.
- The type scale — no page invents a size.
- The CTA voice (radius, weight, padding rhythm).
- The focus ring.
- Nav **N6 masthead** and footer **Ft1 mast-headed**, on every route — with the
  masthead in its `compact` variant on app pages, where a full-size broadsheet
  head over a work panel reads as costume.

### Variants

- **`/dashboard` is exempt from N6 + Ft1.** It is an authenticated admin console,
  not part of the public reading experience; `DashboardSidebar` is its navigation
  and it has no footer. Adding a masthead there would be the costume this system
  exists to avoid. Everything else in this file still binds it: tokens, type
  scale, radius scale, focus ring, surface language, CTA voice.

## What pages MAY differ on

- Macrostructure within their family (Photographic / Workbench / Long Document).
- Hero archetype on marketing pages.
- Section padding rhythm.
- Which optional panels render.

## Exports

### tokens.css

Canonical values live in [`tokens.css`](./tokens.css) at the project root.
`app/globals.css` imports it; Tailwind consumes the same custom properties via
`tailwind.config.ts`. Components reference tokens by name — never an inline hex,
never an inline `oklch()`, never a bare `font-family`.
