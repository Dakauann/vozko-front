# DESIGN.md — Surface, as built

This documents the design system actually in the repository, not the one the
comments aspire to. Where code and stated intention disagree, the code wins and the
disagreement is called out explicitly (§9–10). Paths, class names and counts are
copied or measured from source, not paraphrased. Primary source for the identity
itself is the direction-contract comment in `src/app/layout.tsx` (search `THESIS`) —
emitted as a real HTML comment specifically so it survives production builds and
stays auditable (verified: 291 hits for seed `7fb31c40` in `.next` after a build).

## 1. Identity

**"Surface"** — a fusion of two reference systems, pinned by the user rather than
derived: Microsoft's Fluent 2 for structure and control grammar, Stripe's dashboard
for material and finish.

Content sits **ON** a soft cool canvas as clean white sheets, layered by elevation.
That is the exact inversion of the identity it replaces, in which content was cut
**INTO** an enamel panel and depth was an engraved hairline plus a darker top edge.
Corners are a real ramp (4/6/8/10/12/16px) rather than one flat 2px. Type is Inter
at 14px. Hue-17 orange is unchanged as the brand and is spent only on commit,
selection and focus.

`layout.tsx`: *"An operator tool that looks like the software this business runs its
money through."* Light-as-default is a product-truth call, not taste: Brazilian
operations floors under fluorescent light, full shifts, 1366×768 laptops, text-dense
queues read for hours.

**Topology is inherited unchanged and deliberately so** — the 208px labeled spine,
the 48px header bar starting beside it, the content region below. The user's brief
was explicit that the layout was not the problem; only the finish changed.

Named retirements — all from the *immediately* previous identity, not the one before
it (this redesign was explicitly forbidden from returning to the pre-Console look):

| Retired device | Why |
|---|---|
| Enamel/putty ground (`40 7% 87%`) | A warm beige canvas was the single strongest reason the UI read as old software |
| Single flat 2px radius everywhere | One corner value for a checkbox, a button, a card and a modal is the absence of a system |
| Inset "engraved" elevation (`sm`/`md` = inset rule) | Made every resting surface a machined groove |
| Silkscreen caps legends (10px, `0.14em`, `font-stretch:112%`) | Industrial stencil; 366 sites de-capsed |
| The lamp pip (3×12 hard-cornered bar) | Replaced by the reference systems' selected-item treatment |
| Archivo | A squarer, mechanical skeleton chosen to serve the panel look |
| Zebra-striping attempt in `DashboardTable` | Was `shouldBeDarker ? "bg-muted" : "bg-muted"` — identical branches, and hover was the same grey, so row hover did nothing |

Inherited **unchanged** from the previous identity, because they were right:
tabular figures on every number (`.readout`, 69 sites), no `backdrop-blur` anywhere
(**0** hits in `src/`), channel brand marks keeping their real colours, the touch
floor at 34px below `sm`, and "nothing in the periphery loops."

## 2. Colour

All custom properties live in `src/app/globals.css` (`:root` / `.dark`), HSL triples.

| Token | Light | Dark | Role |
|---|---|---|---|
| `--background` | `210 38% 98%` | `224 24% 8%` | Canvas |
| `--card` | `0 0% 100%` | `224 21% 11%` | Sheet |
| `--muted` | `214 32% 96%` | `223 18% 16%` | Quiet fill / track |
| `--foreground` | `227 37% 16%` | `210 24% 96%` | Default text |
| `--muted-foreground` | `220 14% 42%` | `218 14% 66%` | Secondary text |
| `--border` / `--border-strong` | `214 26% 90%` / `214 20% 80%` | `220 14% 21%` / `220 12% 31%` | Hairline / field edge |
| `--primary` (+hover/active) | `17 100% 42%` (37/32) | same (47/36) | Brand fill |
| `--primary-subtle` | `20 100% 96%` | `17 55% 15%` | Selected ground |
| `--primary-ink` | `15 88% 36%` | `20 100% 68%` | Accent **text** |
| `--healthy` / `--healthy-ink` | `160 84% 26%` / `160 84% 22%` | `158 62% 42%` / `158 62% 58%` | Positive |
| `--warning` / `--warning-ink` | `42 96% 45%` / `32 94% 30%` | `42 94% 55%` / `42 96% 62%` | Caution |
| `--destructive` / `--destructive-ink` | `352 74% 45%` / `352 76% 40%` | `352 78% 48%` / `352 88% 70%` | Fault |
| `--info` / `--info-ink` | `212 92% 43%` / `212 92% 36%` | `210 92% 62%` / `210 92% 70%` | Informational |
| `--ring` | `17 100% 42%` | `17 100% 54%` | Focus |
| `--chart-1..5` | `231/160/43/199/280` | brighter | Series colour |
| `--radius` | `6px` | `6px` | Control corner |

**Three colour rules carry most of the system.**

1. **Every semantic colour has a FILL value and an INK value.** A status colour
   tuned to be legible as a solid fill is not legible as 11px text on a 10–15% wash
   of itself; amber failed first and hardest. `--primary` / `--primary-ink` is the
   same split (`--primary` at L42 is 4.64:1 on white — fine for a button label,
   nothing left for secondary text, so accent text uses `--primary-ink` at 6.45:1).

2. **Focus may own the brand hue.** The previous identity had to give focus its own
   hue (192) because a lit accent pip already meant "current." The pip is retired, so
   focus takes the brand back — which is what both references do.

3. **Warning is pushed to true amber (42) and never carries white.** With an orange
   brand, warning is the colour most at risk of collapsing into the accent.
   `--warning-foreground` is near-black (`24 90% 14%`): white on a mid-lightness
   amber measured **2.4:1**, and it was on 27 sites.

**Contrast is measured, not assumed.** 15 token pairs × 2 themes, all ≥4.5:1
(script preserved at `scratchpad/contrast.mjs`). The tightest are button-label-on-
primary at **4.64:1** and label-on-destructive in dark at **5.01:1** — the latter is
why dark `--destructive` sits at L48 rather than the L54 that looked better in
isolation.

## 3. Typography

Single family: **Inter**, variable, loaded in `layout.tsx`:

```ts
Inter({ variable: "--font-inter", subsets: ["latin","latin-ext"], display: "swap" })
```

`latin-ext` is required, not decorative — pt-BR, de, es all need it. Neither
reference face can ship (one is a system font, the other proprietary); Inter is the
closest honest stand-in for both. `Segoe UI Variable Text` / `Segoe UI` sit high in
the fallback stack for a real reason, not as formality: on the Windows machines a
large share of these operators use, that is the native face of one of the two
systems this design borrows from.

| Register | Spec | Where |
|---|---|---|
| **Page title** | `text-lg` / 600 / `tracking-[-0.015em]` | `DashboardPageHeader` |
| **Body / UI** | 14px (`text-sm`) | Buttons, inputs, nav rows, table body |
| **Label** (`.legend`) | 12px / 600 / sentence case / `-0.005em` / `--muted-foreground` | Nav group headers, field labels, table heads |
| **Micro-label** | 11px | Chips, captions, secondary metadata |
| **Readout** (`.readout`) | `tabular-nums`, `"tnum" 1` | Every number |

**Casing now comes from the i18n string, not from CSS.** Dropping
`text-transform: uppercase` from `.legend` means each translation keeps its own
capitalisation rules — German nouns, Portuguese sentence case — instead of being
flattened to caps.

### Density

`globals.css` scales the root font: **92%** between 1024–1440px, **96%** to 1599px,
100% above. This was 87.5%/93.75%, which was correct when body type was a fixed
`13px` that did *not* scale with it. Body is now 14px in rem and does scale, so
87.5% would have rendered a table cell at 12.25px. 92% lands ~12.9px — the density
the old build actually shipped, with a size that scales.

### Icons

**Tabler**, via the compatibility layer at `src/components/icons/index.tsx`. Import
from `@/components/icons` — **never** from `@tabler/icons-react` directly. The shim
exports ~265 names, accepts and ignores `weight` (~2,300 call sites keep compiling),
and pins `stroke={1.6}` — down from 1.75, because that was balanced against a
squarer, denser face at 13px; Inter at 14px has more open counters and a lighter
colour on the page.

Channel brand marks are the exception and do **not** come from this set:
`src/components/icons/channel-logos.tsx` keeps WhatsApp, Instagram and Telegram in
their real brand colours. This file is explicitly excluded from every palette sweep.

## 4. Space, radius, elevation

**Both scales are remapped in `tailwind.config.ts`, not at the call sites.** This is
the architectural move that makes an identity replacement tractable: ~1,025
`rounded-[--radius]`, ~522 `rounded-lg`, ~138 `shadow-sm` and ~64 `shadow-lg` call
sites changed world without being edited.

```
borderRadius: none 0 · sm 4px · DEFAULT/md var(--radius)=6px · lg 8px · xl 10px · 2xl 12px · 3xl 16px · full 9999px
boxShadow:    sm→--elev-1 · DEFAULT→--elev-2 · md→--elev-3 · lg→--elev-4 · xl→--elev-5 · 2xl→--elev-6
              plus button / button-hover / quiet / quiet-hover
```

**Elevation is stacked again, not cut.** Every `--elev-*` step is two shadows: a
tight near-opaque contact shadow that draws the edge, and a wider softer ambient one
that gives it a room to sit in. Both are tinted with a desaturated slate
(`hsl(228 40% 28%)`) rather than black — a pure-black shadow over a cool canvas goes
grey and dirty, and the tint is what makes the stack read as considered. In dark
mode the tint does nothing (there is no lightness left to remove), so those steps go
to plain black at higher alpha and let the surface-lightness step do the separating.

**Two controls own their own depth.** `--elev-button` carries an inset bottom rule
(`inset 0 -1px 0 hsl(0 0% 0% / 0.12)`) as well as its drop — that single dark line
under the fill is what makes a button read as a key rather than a coloured
rectangle. `--elev-button-quiet` draws its 1px border **as the first shadow layer**
(`0 0 0 1px`), so border and elevation compose instead of double-drawing an edge.

`inner` survives as a genuine inset for the few surfaces that want a recess on
purpose, rather than as the resting state of everything.

`full` is kept for things that are genuinely circular — avatars, status dots,
spinners, switch/checkbox thumbs, and the selection bar (393 hits, §10).

## 5. State language

| State | Signal |
|---|---|
| Rest | `bg-card`, `border-border` or `border-border-strong` |
| Hover (neutral) | `hover:bg-muted` — ground tints, no accent |
| Hover (button) | Colour step **plus** `-translate-y-px` and a deeper shadow |
| Pressed | `active:translate-y-0` + `--primary-active` — a different colour, never a fade |
| Selected / current | `bg-primary-subtle` + `text-primary-ink` + `font-semibold` + the `.lamp` bar |
| Commit | `bg-primary text-primary-foreground shadow-button` |
| Focus | `ring-2 ring-ring ring-offset-2` on controls; on fields, a 2px brand underline **plus** a soft halo |
| Disabled | `bg-muted text-muted-foreground shadow-none translate-y-0` — flat chip, no elevation |

**The field focus state is the signature detail.** One reference marks a focused
field with a 2px brand rule along its bottom edge and nothing else; the other marks
it with a soft halo and no underline. This does both — and draws the underline as an
**inset shadow** rather than a border, so there is no layout shift, no extra DOM, and
it drops into every bare `<input>` in the app. The two compose because Tailwind
renders `ring` and `shadow` through separate custom properties. The border stays
neutral on focus deliberately: when it also went brand-coloured it swallowed the
underline it was supposed to partner.

State never rests on colour alone. A selected nav row carries a tinted ground, brand
ink, a heavier label **and** the bar.

## 6. Layout & shell

Inherited unchanged. A full-height **208px spine** owns the top-left corner; a
**48px header bar** starts beside it, not above it.

```ts
// src/contexts/sidebar-context.tsx
export const SPINE_WIDTH_OPEN = 208;
export const SPINE_WIDTH_RAIL = 52;
```

`DashboardMainContent`'s `marginLeft` must equal the spine's rendered width, or
full-bleed views (CRM, live-chat) show a visible gap. `dashboard-navbar.tsx` mirrors
the spine width (`isCollapsed ? "md:left-[52px]" : "md:left-[208px]"`) with the same
easing so both edges move together. The header bar now also carries `shadow-sm`, so
it separates from content scrolling under it.

Workspace selector at the spine head (it scopes everything below it); department
switcher in the header bar (it filters the current view).

## 7. Components

**Buttons — two parallel implementations, one grammar.** `ui/button.tsx` (cva;
`primary`/`secondary`/`outline`/`ghost`/**`destructive`**, new) has ~7 consumers;
`elevated-design/button.tsx` is the de facto standard at **125** consumers and keeps
its legacy alias table (`main-cta`, `vsl-cta` → `primary`/`vsl`). Both now carry
identical grammar: discrete rest/hover/pressed colour steps, `shadow-button` with the
inset bottom rule, one-pixel lift on hover, `active:translate-y-0`. Heights are
28/32/40 (`sm`/`default`/`lg`), with `sm:` prefixes only as the mobile touch floor.

**Fields.** `ui/input.tsx`, `ui/textarea.tsx`, `ui/select.tsx` and the three
`elevated-*` equivalents share one recipe: `bg-card`, `border-border-strong`, and the
underline-plus-halo focus. `elevated-input` heights came down 40/48/56 → **36/40/48**
and padding 16–24px → 12–14px; its label renders *above* the field, so the extra
height was buying nothing while sitting beside 32px buttons.

`elevated-input`/`-textarea`/`-select` had a real bug: they stacked `bg-card` **and**
`bg-muted` on the same element, so the later class won and every field in the app
rendered as a grey sunk track regardless of the variant a page asked for.

**Cards.** `ui/card.tsx` is `rounded-lg border border-border bg-card shadow-sm`. The
`.well` recipe in `globals.css` is the same material under its old name (35 call
sites keep working).

**Tables.** `elevated-design/table/dashboard-table.tsx` (**28** consumers) is the
real table: quiet head fill on a `border-border-strong` rule, white rows, hairline
row rules from `divide-y`, `hover:bg-muted`, and `bg-primary-subtle` on a selected
row. No zebra — deliberately, and now actually. `ui/table.tsx` documents the same
system and still has **0** live consumers.

**Badges.** `ui/badge.tsx` is borderless tinted fills in sentence case —
`default`/`secondary`/`destructive`/`healthy`/`warning`/`info`/`outline` — each
pairing a 10–15% wash with that hue's **ink**.

**Segmented toggles.** `elevated-pill-toggle.tsx` (9 consumers): a quiet track with
the selected segment raised out of it as a white sheet on `shadow-sm`, labelled in
brand ink. No accent fill — that would put a saturated block in the middle of every
CRM toolbar.

**Menus.** Rows are inset, rounded (`rounded-[--radius]`), 30px tall, and tint on
hover. The previous 4px accent stripe on the leading edge (`border-l-4`) is gone from
`dropdown-menu.tsx`, `elevated-select.tsx` and `elevated-command-select.tsx`: it read
as a side-tab and forced every row to square its corners inside a rounded menu.
Overlay surfaces (`bg-popover`) take the 8px container corner.

**Category tiles.** `.ink-plate` + `.ink-1..5` — a quiet neutral plate carrying a
glyph in one of the five chart-series inks. This replaced 25 saturated
`bg-gradient-to-br from-violet-500 …` tiles across the agent, workflow and WhatsApp
builder surfaces; the inks are the chart series on purpose, so a category reads the
same in a tile as it does in a graph.

## 8. Motion

```
transitionDuration.DEFAULT = 150ms   (was 120ms)
transitionTimingFunction.DEFAULT = cubic-bezier(0.33, 0, 0.67, 1)   // symmetric, in-place change
transitionTimingFunction.panel   = cubic-bezier(0.1, 0.9, 0.2, 1)   // decelerate, for arrivals
transitionTimingFunction.exit    = cubic-bezier(0.9, 0.1, 1, 0.2)
```

The rule inherited from the previous identity holds and was right: **state only,
nothing in the periphery loops.** Two loops are allowed and both report live work —
the kanban arrival pulse and the `dot-pulse` typing indicator, which replaced
Tailwind's `animate-bounce` (a springy translate that reads as a toy).

**Honest gap, unchanged from before:** the 150ms band is real in the navigation
chrome and the controls rebuilt here, but was not retrofitted everywhere.
`ui/dialog.tsx` still hardcodes `duration-200`; `CrmInbox.tsx` and
`CrmConversationView.tsx` still contain 800ms transitions; `AnalysisStatsPanel.tsx`
runs several at 300–400ms.

## 9. Guardrails

- **Colour is a MARK, never a wash behind its own hue.** This is the hardest rule
  in the system and the one most likely to drift back, because the banned shape is
  the default every tool reaches for. Two forms are prohibited:

  1. A tint of a hue (5–30%) carrying text or a glyph in a darker shade of that
     *same* hue — `bg-healthy/10 text-healthy-ink`, `bg-primary-subtle
     text-primary-ink`. It is the single most recognisable tell of a generated
     interface, it muddies at small sizes, and it makes six distinct states read
     as six shades of one thing.
  2. A saturated block carrying a **white** glyph, where the block's colour comes
     from a prop. It fails outright the moment a caller passes a neutral fill —
     white-on-pale, invisible — and when it works it puts a grid of solid colour
     blocks on a page for something that is only labelling a section.

  What replaces both: **one neutral ground, and the status in the mark.** Glyph
  tiles (`.tile-*`) are all the same `--muted` plate with the same hairline; only
  the glyph's colour changes. Badges are all `bg-muted`; only the label's ink
  changes. A selected row is `bg-muted` with a weighted label and the orange
  `.lamp` bar on its leading edge. The accent survives as a **fill** only where it
  means commit — a primary button — and as a **bar, dot or glyph** everywhere else.

  Measured consequence: every status ink now sits on one known ground, so all of
  them clear AA with headroom (5.4–6.4:1 light, 5.4–9.4:1 dark) instead of each
  needing its own tuned wash.

- **Depth is stacked, never faked.** No bevels, no faux metal, no gradient-as-
  material, no zero-offset coloured halos. Two-layer tinted shadows only.

- **Nothing renders at a 0px corner.** Every surface that draws a box sits on the
  ramp: 6px on controls and chips, 8px on panels and bubbles, 10–16px on large
  containers. The only square edges left are genuine panel splits — a full-bleed
  shell, the divider between a rail and its content — where a corner would have
  nothing to round against.
- **Accent is commit, selection and focus.** Not decoration. `DashboardPageHeader`
  still has no accent tile behind its glyph, for the same reason as before: it
  appeared on all 77 pages.
- **Every semantic colour ships as a fill/ink pair.** Never put a fill value on text
  sitting on a wash of itself.
- **No `backdrop-blur` glass.** Confirmed: **0** hits in `src/`.
- **Channel brand marks keep their real colours.** `icons/channel-logos.tsx` is
  excluded from every sweep by name. A brand mark that recolours with the
  surrounding theme is no longer the brand mark.
- **Voice iconography** — the rule from the previous DESIGN.md carries over intact.
  PRODUCT.md's constraint is narrow: the product does **not** offer AI voice calls,
  and no surface may claim or imply AI-automated phone calls. Human telephony
  iconography for shipped features stays. Never pair AI branding with call/dial
  iconography in the same control; never render a live-call or record affordance as
  a decorative accent; copy never implies the product places calls on its own.

## 10. Known gaps

Measured today, not estimated.

**The per-file craft pass is partial.** The design *system* is fully replaced and
verified; roughly 100 individual component and page files were never opened and
judged by eye. They moved to the new world through the remapped scales and the token
sweeps, which is why the build is coherent — but "inherited correctly" is not the
same as "designed." `UI_REDESIGN_TODO.md` at the repo root is the review queue and
is explicit about which is which.

```
rounded-full          393   avatars, dots, spinners, thumbs, the selection bar — legitimate
text-white            202   down from 312; the 110 that sat on a semantic fill are fixed
uppercase              10   4 are avatar initials (correct); 6 in comments / toUpperCase
bg-gradient-to-        11   all scrims (image/video overlays) or the WhatsApp preview chrome
.legend (class)         4   the CSS recipe; ~160 consumers reference it by name
```

**`text-white` (202).** The dangerous cases are done: every occurrence sitting on
`bg-primary`/`destructive`/`healthy`/`warning`/`info` now uses that fill's own
foreground token. What remains is mostly white on imagery, on dark chrome, or on
brand-coloured channel surfaces. It has not been audited case by case.

**Legacy token aliases are still defined and still referenced.** `--lamp`,
`--lamp-ink` and `--rule-strong` resolve to the brand and hairline tokens, and
`--shadow-highlight[-strong]` stay `transparent` so hand-written shadow strings that
interpolate them remain valid. `text-primary-ink` (302 sites) is the migrated name;
`lamp`/`lamp-ink` remain registered in `tailwind.config.ts` as a safety net for any
dynamically-composed class the sweep could not see.

**Dead pre-Console files were deliberately NOT deleted.** `elevated-design/`
still contains `grain-card.tsx`, `marquee.tsx`, `floating-path.tsx`,
`chart-graphics.tsx`, a 0-byte `dialog.tsx`, `badge.tsx` (imported once by
`CrmMessageInput.tsx` and never rendered), and the `pricing/*` and `faq/*` families —
all with zero live render paths. The brief was "design only, do not break
functionality," and deleting files is neither. They are inert.

**Two of those files WERE live and are neutralised in place rather than deleted:**
- `grain-background.tsx` rendered a seeded, warped, multi-colour blob field. Via
  `ui/confirm-dialog.tsx` it was painting a candy-coloured field behind **every
  confirmation dialog in the product**. It now returns a quiet surface; the whole
  prop surface, the palettes, `createSeededGradient` and the exported types are
  still there so `TourGuide`, `grain-card` and the dialogs compile untouched.
- `gradient-text.tsx` (live in `settings/page.tsx` and `admin-metrics-dashboard.tsx`)
  no longer clips text to a gradient that faded its tail to 30% opacity. Emphasis
  comes from the weight and size map it already had.

**Adoption skew persists.** `ui/*` primitives remain the cleanest reference and are
barely used: `ui/table.tsx` **0** consumers, `ui/button.tsx` **7**, versus
`elevated-design/button.tsx` **125** and `.../dashboard-table.tsx` **28**. Both
button implementations now carry the same grammar, so the skew costs less than it
did — but it is still two files to keep in sync.

**One file was corrupted and restored during this work.**
`src/components/crm/CrmConversationView.tsx` has 3,000-character lines; an early
whole-file quote-pairing sweep mispaired across them and broke its JSX. It was
restored from git and re-swept with a line-local rule. Every other swept file was
verified by normalising old against new source and confirming the only differences
were the intended token rewrites.

## 11. Verification (this build)

| Check | Baseline | After |
|---|---|---|
| `tsc --noEmit` | clean | clean |
| `next build` | clean, 292 static pages | clean, **292** static pages |
| `vitest` | 24 fail / 306 pass | **24 fail / 306 pass — identical** |
| ESLint | 214 errors / 225 warnings | **214 errors** / 227 warnings |
| Impeccable detector | 18 findings | **1** (false positive: `<img src>` in a doc comment in `app/actions/instagram.ts`) |
| Contrast, 15 pairs × 2 themes | not measured | **30/30 clear AA** |
| Direction contract in built output | — | **291** hits for seed `7fb31c40` |

The 24 test failures are the pre-existing baseline and are unrelated to this work.
The +2 lint warnings are unused `eslint-disable` directives that became redundant
when `grain-background`'s render was neutralised.
