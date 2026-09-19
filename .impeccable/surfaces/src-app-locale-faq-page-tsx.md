---
version: 1
slug: "src-app-locale-faq-page-tsx"
primary_target: "src/app/[locale]/faq/page.tsx"
related_targets: ["src/app/[locale]/faq/[slug]/page.tsx","src/components/faq/faq.module.css"]
---

## Scope and mode

The public FAQ: the index at `/[locale]/faq` and post pages at `/[locale]/faq/<slug>`.
Visitor mode is **Read**. The first post is `novos-custos-meta`, on Meta's
1 October 2026 WhatsApp service-message billing change.

## Audience and job

Written customer-first but with no logged-in assumptions, so it also serves anyone
searching the Meta change. The reader is a Brazilian collections, sales or support
operator who lives in a WhatsApp queue. Their real question is never "what is the
rate card", it is "which of the forty replies I sent this morning just cost money".

## Direction

Inherits the landing's visual world (`landing.module.css`): Oxanium titles, Inter
body, mono metadata lines, hairline section dividers, 6px control corners, the same
button geometry. Two deliberate departures, both Read-mode calls:

- **Display sizes step down about a third.** The landing headline is a poster; this
  is an article.
- **One centred 48rem column, not the landing's 80rem stage.** At 80rem a paragraph
  occupies the left half of the screen and leaves the right half empty.

**Colour carries exactly one idea, and only one:** `--healthy` (hue 152) means the
message is free, `--warning` means it is billed. Brand green keeps its usual job on
links, focus and the primary button, so the reader never has to work out which green
means what. Every verdict ships as ground plus glyph plus word.

## Settled, do not re-litigate

- **The transcripts are static.** They used to reveal turn by turn on scroll. A thread
  is taller than the viewport, so the IntersectionObserver that started the reveal
  never fired and readers met a tall empty box. A reading page shows its content.
- **The conversation must fit one screen.** Layout is `clock | message | verdict`, so
  verdicts line up in one scannable column and the argument reads before a word does.
  Density is a requirement here, not a preference.
- **The allowance is one bar with two parts,** each label set inside the part it names.
  An earlier 50-segment meter read as a barcode and hid the 1,000 threshold.
- **The 24h window is a vertical clock,** not a horizontal track. Horizontal collided
  its own labels at every width, and vertical needs no separate phone layout.
- **Transcripts are NOT a WhatsApp skin.** They are diagrams of a bill; a green chat
  bubble beside a green brand accent makes the page argue with itself.
- **Slugs are canonical across all four locales.** One URL to share, survives a
  language switch. Only the body is translated.
- **The index is a ruled ledger, not a card grid.** Right at one entry and at forty.
- **The navbar FAQ link is centred**, in its own overlay zone, not grouped with the
  theme, language and sign-in cluster. Those are settings; FAQ is content, and sitting
  beside the theme toggle made it read as a fourth utility control. Centring on the
  bar rather than between the two clusters keeps it put when the auth state changes
  the right cluster's width. It carries full-strength ink, because standing alone it
  is a destination rather than a utility, and the active route takes a muted chip.

## Claim discipline

Every factual claim about Meta is sourced in the post's own Sources section, and the
post says in its own words that the decision is Meta's, applies to every provider,
and that no platform can exempt a message Meta classified as chargeable. The Brazil
reference rate (US$0.0068) and the USD/BRL rate (5.12) are both date-stamped on the
page; they live in `instruments.tsx` as named constants.

## Open

Only one post exists. The index and registry are built for many; nothing else about
the surface is unresolved.
