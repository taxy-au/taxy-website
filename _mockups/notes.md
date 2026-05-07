# Homepage redesign — feedback notes

Working notes from the mockup review session. Pick up tomorrow on `phase-3-foundation` branch.

## Architectural decision

**Single-page homepage.** Nav jumps to anchors on the same page. Header stays sticky as you scroll. Pricing lives on the homepage as a section (and probably also as a standalone page eventually — TBD).

Trade-off acknowledged: not ideal for SEO, but **simplicity + ship-now wins** for Phase 3.

## Direction

**Base structure: Option 1 (Editorial).** Long, calm, problem-led scroll — keep this skeleton.

**Pull from Option 3 (Founder-led):**
- Big 01/02/03 numerals on the three mechanics (vertical list, not cards)
- Dark proof section treatment (Kirsty quote + stats)
- "What your clients see" phone trio — Amanda **loves** this

**Pull mechanic from Option 2 (Product-led split-scroll):**
- The sticky/pinned scroll pattern is interesting, but **not for product features**.
- TBD what to use it for — open question.

**Drop:**
- Feature-led product narrative.
- Founder-led narrative as the human moment — Kirsty does that better.

## Sections on the homepage

1. **Problem & principles-based solution** — the three mechanics with big 01/02/03 numerals from Option 3. Copy needs rephrasing for the home page: anchor on the problem and how the principles flow through to the product (less feature-y, more mechanic-y).
2. **Firm proof** — Kirsty's testimonial.
3. **Client proof** — Adrian / Karin / Alison / Chris testimonials.
4. **What clients see** — desktop mockup (not mobile/phones — Amanda's leaning desktop now). Sits close to client testimonials.
5. **ROI / time-saving** — the anonymised stats from `homepage-proof-stats` memory (8wk→1wk, 10wk→3wk, 30m→5m, $1:$10). Probably **merged into firm proof** rather than its own section.
6. **Pricing** — new section, on-page.
7. **POC / Get started** — Try Taxy with one client group tile (needs refining — close but not right).
8. **FAQs** — a couple of extra questions to add later (TBD content, not for now).

## Recommended section order

```
HERO (kept)
 ↓
§ Problem & mechanics       — "do you understand my problem?"
 ↓
§ Firm proof + ROI          — "does it work for firms like mine?"
   Kirsty quote + stats merged
 ↓
§ Client proof + what they see  — "will my clients use it?"
   Voices + desktop mockup together
 ↓
§ Pricing                   — "what does it cost?"
 ↓
§ Start with one client group — "how do I start?"
 ↓
§ FAQs                      — "what about…?"
 ↓
FOOTER
```

**Why this order:** mirrors the buying journey from `brand.md` §7 — pain → mechanic → firm proof → client proof → price → low-risk start → last objections.

**Pricing-before-POC reasoning:** transparent (on-brand, brand value §4), and by the time the reader hits the POC tile they've already digested the cost — so "start with one client group, no commitment" lands without "yeah but how much is it?" still hanging.

## What Amanda specifically called out

### Liked across mockups
- Editorial structural principles (Option 1)
- Problem statement / "our principles" framing (Option 1 §01)
- Big 01/02/03 numerals (Option 3)
- Dark proof section (Option 3)
- "What your clients see" phones (Option 3) — moving to **desktop** not mobile
- POC tile *layout* in both M1 and M3 — but neither feels right yet

### Didn't pick / dropped
- Feature-led product focus (M2)
- Founder-led narrative (M3) — Kirsty carries the human moment

### Open
- Reuse the sticky-scroll mechanic for *something*, not features. What?

## Open questions for next session

1. What should the sticky-scroll mechanic be used for, if not features? (Could be: a customer story arc, a "what changes after a year" before/after, a buying-journey explainer.)
2. What's not quite right about the POC tile? Iterate on copy + layout.
3. Stack vs. split for client proof + "what they see" — voices grid above the desktop mockup, or side-by-side?
4. Pricing section: full pricing detail on the homepage, or teaser + link to a separate /pricing page?
5. §01–§06 numbering: keep on the homepage (editorial feel) or drop (less labelled)?
6. Two extra FAQs to add (Amanda has in mind, will share later).

## Files

- `_mockups/option-1-editorial.html` — base structure pick
- `_mockups/option-2-product-led.html` — scroll pattern source
- `_mockups/option-3-founder-led.html` — proof, phones, big numerals source
