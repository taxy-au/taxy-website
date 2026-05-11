# Homepage cleanup — status

Executed on `phase-3-foundation`. Companion to `~/code/taxy-gtm/context/brand-pack-pending-updates.md`.

## Shipped in this pass

### Quick wins
- Meta description: dropped "information" so it matches the visible "tax workflow platform" subtitle.
- Dropped `needs_swiper: true` from `index.html` — Swiper CSS + JS no longer load on home (saves ~80KB CSS + 150KB JS gzipped).
- Removed `<span id="top">` shim from `_layouts/marketing.html`. Header logo now links to `/` (browser default-scrolls to top).
- Removed redundant "Home" link from header nav.
- Founder-tile hover: red `#ef4444` → brand-palette pink `$color-pink`. Glow + outline both updated.
- Footer legal contrast: rgba opacity 0.55 → 0.7.
- Scroll-padding-top: hoisted to CSS custom property `--header-height` (defined in `_base.scss`), referenced from both `html { scroll-padding-top }` and any future header-relative offsets (e.g. `.client-proof__left` sticky positioning). Header changes now stay in sync automatically.

### Dead code sweep
- Deleted `_includes/`: `concept-card-grid.html`, `cta-book.html`, `feature-grid.html`, `feature-row.html`, `testimonial-carousel.html`, `stat-cards.html`.
- Deleted `_sass/_concept.scss` and `_sass/_proof-stats.scss` entirely (plus removed imports from `main.scss`).
- Trimmed `_founder.scss`: dropped `.founder-grid`, `.founder-card`, `.founder-note__intro`. Kept tiles.
- Trimmed `_layout.scss`: dropped `.section--loose`, `.section--with-clips`, `.section__clip*`, `.section--offwhite`, `.section--dark`, `.split-row__illustration`, `.steps*`.
- Trimmed `_home.scss`: dropped `.home-closer__*`, `.testimonial--featured`, `.pricing-section { padding-block }`.
- Trimmed `_pain-mech.scss`: dropped `.pain*` block and the `.story-graphic` placeholder base (`'Dashboard graphic'` pseudo-content, dashed border). The `--app` variant is now the only `.story-graphic` form.
- Trimmed `_client-proof.scss`: dropped `.tx-pill--waiting` (unused).
- Trimmed `_app-dashboard.scss`: dropped the `.story-graphic--app` override block (no longer needed).
- Removed `.story-graphic--app` modifier from `index.html` markup — the bare `.story-graphic` class now does the job.

### Mobile nav
- Added hamburger button + drawer to `_includes/marketing-header.html`. Hamburger morphs into an X when open. Six nav links + Log In button accessible on mobile.
- Body scroll-locks when the drawer is open (`body.nav-open`).
- Tiny inline script handles toggle + auto-close on link tap and on resize to desktop.

### Section padding rhythm
- Unified to `.section` (normal, $space-7) and `.section--tight` (linked, $space-5). Mobile values: $space-5 / $space-4.
- Applied `.section--tight` to the `.founder` and `.story` sections in `index.html` (these flow together as the problem→solution arc).
- Dropped bespoke `padding-block` overrides from `.founder`, `.story`, `.pricing-section`, `.poc`, `.faq-section`. They now inherit `.section` (normal).
- Net visual change: pricing/poc/faq gain ~16–32px of breathing room; founder/story land at the unified tight value. Page rhythm is consistent across sections.

### Wide-viewport bleed cap
- `.story-graphic` now caps the leftward bleed at the container padding. At viewports wider than the 1400px frame, the dashboard rows stop at the frame edge and let whitespace build to the viewport edge — no more "flying further left." Confirmed at 1745px: card left edge = 172.5px from viewport-left (matches frame-left).

### Typography — 3-weight system
- Dropped 500 from the Lato preload (`marketing.html` now loads `wght@400;700;900`).
- Removed `$fw-medium` from `_tokens.scss`.
- Swept all `font-weight: $fw-medium` usages → `$fw-bold`. Touched: `_base.scss` (h4, h5), `_footer.scss` (footer links), `_stat-cards.scss` (label, unit), `_app-dashboard.scss` (dx-row meta).

### Performance — preconnects
- Added `<link rel="preconnect">` for `googletagmanager.com`, `static.hotjar.com`, `snap.licdn.com` in the marketing layout. Saves ~100–300ms each on first connection. Real fix (consent gate) is separate.

### Loom embed — lite wrapper
- Replaced the bare Loom iframe in the POC section with a poster + play button. Click swaps to the real iframe with `autoplay=1`. Loom player JS (~1MB) only loads when the user actually wants the video.
- Verified click-to-load works and autoplay engages.
- New SCSS partial `_sass/_lite-loom.scss` + tiny click handler in `_layouts/marketing.html`.
- **To swap the video later**: update the three values in `index.html` POC button (`data-loom-id`, `data-loom-sid`, `img src`). The poster URL is taken from Loom's oEmbed `thumbnail_url` field — comment in the markup tells you how to fetch it.

## Outstanding — visual QA you'll want to do

- Tab through the page with keyboard only. Focus rings — I haven't added explicit `:focus-visible` outlines to the nav links / hero CTAs / tile hovers; lite-loom has one but the rest currently inherit browser defaults. If anything looks invisible-on-focus, I can add a project-wide focus style.
- Render at 320 / 768 / 1024 / 1440 / 1920. I checked 390 / 1280 / 1440 / 1745. The pad system is consistent but worth eyeballing the founder→story transition at each width to make sure the rhythm reads continuously.

## Outstanding — pending brand-pack ratification

- **Off-token colour migration.** The website still uses one-off hex codes for muted-nightshade variants (`#3D3548`), purple gradient stops (`#1a0f2b`, `#3d1a6b`, `#7E2EE8`), and pill colour pairs (`#dff9ef/#0e6b52`, etc.). Once `brand-pack-pending-updates.md` §6 is ratified, these can move into named tokens.
- **Font weight scale in brand.md.** The 3-weight system is live on the website (Regular/Bold/Black). `brand-pack-pending-updates.md` §4 captures the doc update — H4/H5 from Medium → Bold, drop the "max 2 weights" rule.

## Known non-issues / deferred

- `:focus-visible` outlines on hero/POC primary buttons — left as browser default. Add if you want a consistent purple ring.
- Pricing feature list `::before { content: '✓' }` reads as "check mark" to screen readers before each item. Verbose but accurate. Leave.
- Hardcoded `width="1304" height="978"` etc. on Loom iframe (now replaced by lite-loom): no longer relevant.

## Files touched

```
index.html
_layouts/marketing.html
_includes/marketing-header.html
_sass/_tokens.scss
_sass/_base.scss
_sass/_layout.scss
_sass/_footer.scss
_sass/_header.scss
_sass/_stat-cards.scss
_sass/_app-dashboard.scss
_sass/_founder.scss
_sass/_home.scss
_sass/_pain-mech.scss
_sass/_poc.scss
_sass/_faq.scss
_sass/_client-proof.scss
_sass/_lite-loom.scss   (new)
assets/css/main.scss
```

Deleted: 6 includes, 2 SCSS partials.
