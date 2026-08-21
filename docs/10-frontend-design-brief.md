# Frontend Design Enhancement Brief — stingdev

**Purpose:** A self-contained requirements document to hand to a design pass
(Claude or a designer) for **visually enhancing the existing frontend** of the
stingdev platform. The functionality is complete and tested (283 tests) — this
brief is about **elevating the visual craft, polish, and conversion**, not
rebuilding or changing behavior.

> Read this together with [06-design-system.md](06-design-system.md) (the
> current design system) and [08-roadmap.md](08-roadmap.md) (what exists).

---

## 1. What stingdev is

A business platform for a Sudanese full-stack developer / systems analyst:
marketing site + blog + client portal + dashboard. The public site must
**win freelance clients** in Sudan and the Gulf. Tone: modern, professional,
calm, trustworthy — *"a systems developer you can rely on,"* not a flashy
agency. The visitor's core questions the design must answer fast: *Is this
person credible? Can they build my system? How do I start?*

**Primary conversion goals** (design must serve these, in order):
1. Start a project → `/request-quote` (3-step form) or WhatsApp.
2. Build trust → projects, case studies, process, testimonials.
3. Grow authority → blog, technologies.

---

## 2. Hard constraints (non-negotiable — do not break these)

The current build already honors all of these. Any visual enhancement **must
preserve** them:

| Constraint | Rule |
|---|---|
| **Arabic-first, RTL** | Arabic is default (`/ar`), right-to-left. English (`/en`) is LTR. Layout mirrors correctly. |
| **Logical CSS only** | Use `ms/me/ps/pe/start/end/text-start`. **Never** `left/right/ml/mr`. This is how RTL/LTR both work from one codebase. |
| **Arabic type rules** | `letter-spacing: 0` for Arabic (breaks letter joining). No `italic`, no `text-transform`, no `word-break` on Arabic. Line-height is higher for Arabic (1.9 body) than Latin (1.65). |
| **Fonts** | Cairo (Arabic) + Inter (English), self-hosted via `next/font`. Switches automatically by locale via `--font-sans`. Do not add CDN fonts. |
| **Semantic color tokens** | All color goes through CSS variables (see §4). Never hardcode hex in components. This is what makes dark mode free. |
| **Dark mode** | Light / dark / system, no flash on load. Every enhancement must look correct in **both** themes. |
| **Server Components default** | Public pages are Server Components. Interactivity (`"use client"`) is the exception. Don't convert whole pages to client for animation. |
| **Accessibility WCAG 2.2 AA** | Visible focus rings (never `outline:none`), 44px touch targets, labeled inputs, `alt` text, logical heading order, `prefers-reduced-motion` respected. |
| **Performance budget** | Shared JS ~103 kB, homepage ~113 kB. Keep First Load JS low. No heavy client libs for decoration. |
| **No fake content** | Empty sections auto-hide. Design must look great at **low content volume** (a new site with 2 projects, 0 testimonials) — not just when full. |

---

## 3. Current state (what you're enhancing)

**Stack:** Next.js 15 (App Router) · Tailwind CSS · TypeScript. `framer-motion`
is installed but **currently unused** — it may be used for tasteful motion (see §7).

**Existing UI components** (`src/components/`):
- `ui/`: `button.tsx` (Button, ButtonLink, ExternalButtonLink), `container.tsx`,
  `section.tsx` (Section, SectionHeader), `misc.tsx` (Badge, Card, Prose,
  Breadcrumbs, JsonLd), `states.tsx` (EmptyState, ErrorState, Skeleton, CardSkeletonGrid).
- `content/`: `cards.tsx` (ServiceCard, ProjectCard, CaseStudyCard, TechBadge,
  StatCard, TestimonialCard), `media.tsx` (CoverImage).
- `sections/home.tsx`: Hero, Intro, Stats, Services, Solutions, Projects,
  CaseStudies, Process, Technologies, Testimonials, Posts, CTA.

**Public pages:** home (14 orderable sections), about, services + `[slug]`,
solutions + `[slug]`, projects + `[slug]`, case-studies + `[slug]`, blog +
`[slug]`, technologies, process, contact, request-quote, auth pages, member
area (overview/saved/comments/settings), legal, offline.

**Current aesthetic:** clean, minimal, card-based, blue primary. Functional but
**visually plain** — this is the gap to close. It reads as "a competent
developer built this" but not yet "this developer has taste."

---

## 4a. Chosen palette — "Indigo + Cyan" (✅ implemented)

A concrete, attractive, modern palette was selected and applied to replace the
generic blue-on-slate. It is distinctive (indigo, not everyone's default blue),
premium (indigo-tinted dark surfaces instead of flat grey), and cohesive.

| Token | Light | Dark | Note |
|---|---|---|---|
| `--primary` | `#4F46E5` indigo-600 | `#818CF8` indigo-400 | brighter in dark for contrast |
| `--accent` | `#06B6D4` cyan-500 | `#22D3EE` cyan-400 | spice, paired with indigo |
| `--background` | `#F8FAFC` | `#080814` | dark = deep indigo-black |
| `--surface` | `#FFFFFF` | `#141426` | dark panels tinted indigo, not grey |
| `--foreground` | `#0F172A` | `#EDEDF6` | |

Added modern tokens (light + dark, in `globals.css`):
- `--gradient-brand` — indigo → cyan diagonal, exposed as `bg-brand` and used by
  `.text-gradient` (headline highlight, stat numbers) and the section accent bar.
- `--shadow-sm/md/lg` — layered soft shadows, dark-mode aware; exposed as
  `shadow-subtle / shadow-card / shadow-elevated`.
- Utilities: `.hero-surface` (soft radial glow + masked dot-grid, no images),
  `.glow-ring` (premium framed elevation), `.text-gradient`.

Applied so far: Hero (gradient background, gradient headline word, glowing image
frame, live "available" badge), Button (branded glow + lift on hover, larger
radius), Card (lift + primary-tinted border + elevated shadow on hover),
SectionHeader (gradient accent bar), StatCard (gradient numbers + hover).
All verified in the production CSS; old `#2563EB` fully removed. Remaining
priorities (P2–P6 below) extend the same language to detail pages and blog.

## 4. Design tokens (base system)

Colors are `R G B` triplets consumed via `rgb(var(--token) / <alpha>)`.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--background` | `248 250 252` | `2 6 23` | page bg |
| `--surface` | `255 255 255` | `15 23 42` | cards, panels |
| `--surface-hover` | `241 245 249` | `30 41 59` | hover states |
| `--foreground` | `15 23 42` | `241 245 249` | text |
| `--foreground-muted` | `100 116 139` | `148 163 184` | secondary text |
| `--border` | `226 232 240` | `30 41 59` | borders, dividers |
| `--primary` | `37 99 235` (#2563EB) | `59 130 246` | primary action |
| `--accent` | `6 182 212` | `34 211 238` | highlight |
| `--success/warning/danger` | 16 185 129 / 245 158 11 / 239 68 68 | — | states |
| `--ring` | matches primary | — | focus ring |

**You may add tokens** (e.g. gradient stops, elevation shadows, a warm neutral
for backgrounds) — but add them to `globals.css` as variables with **both**
light and dark values, and expose via `tailwind.config.ts`. Never introduce a
raw hex in a component.

Type scale (in `tailwind.config.ts`): `display`, `h1`, `h2`, `h3` use `clamp()`.
Spacing on a 4px base. Radii `sm/DEFAULT/lg/xl`. Shadows are currently very
subtle (`subtle`, `card`).

---

## 5. What to enhance — priorities

Ranked by impact on the conversion goals. Each item says **what** and **why**,
leaving execution to the design pass.

### P1 — Hero (`HeroSection`) — the single highest-impact surface
The first screen decides whether the visitor stays. Currently: name, title,
headline, two buttons, a square image placeholder.
- Give it real visual presence: considered composition, depth, a purposeful
  background treatment (subtle gradient/grid/dot-field — **not** a heavy image
  or video; Hero must stay fast, no video per constraints).
- Make the primary CTA ("اطلب مشروعك" / Start a project) unmistakable.
- The owner photo/tech-image slot should feel intentional, with a graceful
  fallback when no image exists (it currently shows a flat gradient block).
- Consider a trust strip (years, projects delivered, sectors) if stats exist —
  but it must gracefully vanish when empty.

### P2 — Cards (Service / Project / CaseStudy / Testimonial)
Cards are the repeated visual unit across the whole site — polishing them lifts
every page at once.
- Stronger hierarchy, better use of the cover image, refined hover elevation,
  clearer "read more" affordance with a direction-aware arrow (already handled
  for RTL — keep it).
- Project cards should feel like portfolio pieces (sector/type badges, tech
  chips, client name or "undisclosed").
- Empty/placeholder imagery should look deliberate, not broken.

### P3 — Section rhythm & headers (`Section`, `SectionHeader`)
The homepage stacks 14 sections; without rhythm it reads monotonous.
- Introduce deliberate alternation (surface tone, spacing, optional dividers)
  so sections breathe and the eye flows.
- `SectionHeader` could carry more character (eyebrow label, refined
  type pairing) while staying calm.

### P4 — Service / Solution / Project / Case-study detail pages
These are the pages that actually sell. They're content-dense.
- Improve long-form readability (`Prose`): measure, spacing, headings within
  content, pull-quotes for case studies.
- The sticky sidebar (price/sector/CTA) should feel like a confident "call to
  action" panel.
- Case studies especially (problem → solution → results → metrics) deserve an
  editorial, story-driven layout with strong metric display.

### P5 — Micro-details & states
- Buttons: refine the variant system (primary/secondary/outline/ghost) — weight,
  hover, focus, loading spinner.
- Empty/error/skeleton states already exist — make them charming, not clinical.
- Badges, chips, breadcrumbs, the WhatsApp floating button — small, high-frequency
  elements that signal quality.
- Header/footer polish; the member menu and theme/locale toggles.

### P6 — Blog & reading experience
- Article page typography, cover treatment, reading-time/meta, related posts,
  the comments section styling.

---

## 6. Design principles to apply

- **Restraint over decoration.** This is a systems developer's site. Precision
  and clarity signal competence better than gradients-everywhere. When in doubt,
  remove.
- **Depth through hierarchy, not noise.** Use spacing, weight, and a *little*
  elevation — not borders on everything.
- **One accent, used sparingly.** Primary blue leads; the cyan accent is a spice,
  not a second primary.
- **Content-first.** Design the low-content state first. The site must look
  finished with two projects and no testimonials.
- **Bilingual symmetry.** Every layout must feel native in both Arabic (RTL) and
  English (LTR) — test both. Arabic is the primary audience; it must never feel
  like a translated afterthought.
- **Dark mode is a first-class design, not an inversion.** Check contrast and
  mood in both themes for every change.

---

## 7. Motion (optional, tasteful)

`framer-motion` is available but unused. If motion is added:
- Section reveal on scroll (`opacity 0→1` + `translateY 12px→0`, ~400ms,
  `once: true`). No parallax, no bounce, no auto-playing loops.
- Hover/focus transitions ≤150ms.
- Import motion **dynamically** in the specific client component only — never in
  the root layout (keeps public pages as Server Components).
- **Must** collapse to instant under `prefers-reduced-motion` (already wired
  centrally via CSS duration variables — reuse that, don't fight it).

---

## 8. Explicit do-not list

- ❌ Do not add CDN fonts, Google Fonts `<link>`, or icon fonts (lucide-react is
  the icon set, tree-shaken).
- ❌ Do not use `left/right/ml/mr/pl/pr/text-left` — logical properties only.
- ❌ Do not hardcode colors; extend the token system.
- ❌ Do not add `letter-spacing`, `italic`, or `uppercase` to Arabic text.
- ❌ Do not put video or large images in the Hero.
- ❌ Do not convert Server Component pages to client just for animation.
- ❌ Do not introduce a heavy UI/animation library or a component kit that
  fights Tailwind + the token system.
- ❌ Do not design only the "full content" state — empty states are the launch
  reality.
- ❌ Do not change routes, data fetching, API shapes, or behavior — **visual and
  CSS/markup only**.

---

## 9. Deliverables expected from the design pass

1. **Updated design tokens** in `globals.css` + `tailwind.config.ts` (new
   shadows/gradients/neutrals as needed, light + dark).
2. **Refined shared components** (Button, Card, Section/SectionHeader, the card
   family, states) — same props/API, better visuals.
3. **Enhanced Hero** and homepage section rhythm.
4. **Detail-page polish** (service/project/case-study reading layout + sidebar).
5. Everything verified in: **Arabic + English**, **light + dark**, **mobile +
   desktop (375 / 768 / 1440)**, keyboard focus visible, `prefers-reduced-motion`
   honored.
6. Build stays green (`python run.py build`), typecheck clean, First Load JS
   within budget, Lighthouse a11y/best-practices/SEO = 100.

---

## 10. How to work in this repo

- Public site lives in `frontend/src/app/[locale]/(site)/` with shared UI in
  `frontend/src/components/`. Tokens in `frontend/src/app/globals.css`, Tailwind
  in `frontend/tailwind.config.ts`.
- Run the app: `python run.py dev` (site on `:3000`). Build: `python run.py build`.
  Full checks: `python run.py check`.
- The backend is complete and provides all content; you don't need to touch it.
  If a design needs a new field (e.g. a hero background image), note it as a
  follow-up rather than changing the API in this pass.
- Keep changes reviewable: token + component layer first, then pages.
