---
name: Vozko
description: Signal-green on graphite — the Vozko brand board executed as a token system over an operator console.
colors:
  signal-green: "hsl(164 100% 41%)"
  signal-green-daylight: "hsl(164 100% 38%)"
  green-ink: "hsl(165 100% 24%)"
  green-ink-dark: "hsl(163 88% 48%)"
  graphite-canvas: "#0D0F10"
  graphite-sheet: "#1A1D20"
  graphite-hairline: "#2C3136"
  daylight-canvas: "hsl(200 24% 97%)"
  daylight-sheet: "#FFFFFF"
  ink: "hsl(206 15% 9%)"
  ink-secondary: "hsl(206 9% 38%)"
  healthy: "hsl(152 90% 27%)"
  warning: "hsl(42 96% 45%)"
  fault: "hsl(352 74% 44%)"
  info: "hsl(210 90% 42%)"
typography:
  display:
    fontFamily: "Oxanium, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "0.01em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, Segoe UI Variable Text, Segoe UI, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    letterSpacing: "-0.005em"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "10px"
  "2xl": "12px"
  "3xl": "16px"
components:
  button-primary:
    backgroundColor: "{colors.signal-green-daylight}"
    textColor: "hsl(200 10% 6%)"
    rounded: "{rounded.md}"
    height: "32px"
  button-primary-hover:
    backgroundColor: "hsl(164 100% 33%)"
    textColor: "hsl(200 10% 6%)"
  button-secondary:
    backgroundColor: "{colors.daylight-sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "32px"
  field:
    backgroundColor: "{colors.daylight-sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "36px"
---

# Design System: Vozko

This documents the design system actually in the repository, not the one the
comments aspire to. Where code and stated intention disagree, the code wins and
the disagreement is called out (see Layout and Known Gaps). Paths, class names
and counts are copied or measured from source. The identity's primary source is
the direction-contract comment in `src/app/layout.tsx` (search `THESIS`) —
emitted as a real HTML comment so it survives production builds (verified: 291
hits for seed `00d09a7f` in `.next`). Frontmatter values are the light theme,
the product default; dark counterparts are in Colors.

## Overview

**Creative North Star: "The CRM that wears its own circuitry."**

The identity is the user's own brand board, pinned 2026-08-23 and executed at
full fidelity in both themes: signal-green **#00D09A** on graphite, a squared
techno display face (Oxanium) over a workhorse body face (Inter), and circuit
traces plus dot matrices as the only ornament. It replaces "Surface" — hue-17
orange on Fluent/Stripe chrome — and refuses two worlds at once: the
borrowed-cloud look it retired, and the neon-cyberpunk reading of its own
board. **Glow is not a material here; contrast is.** No gradient fills, no
halos-as-decoration, no `backdrop-blur` (0 hits in `src/`).

The material model is inherited from Surface because it was right: content
sits ON the canvas as sheets layered by real elevation, borders are
boundaries, depth is a two-layer micro-shadow stack. What changed is the world
on top — the green is spent exactly where the orange was: **commit, selection
and focus. Never decoration.**

Both themes are first-class (`ui/theme-toggle.tsx`), with distinct jobs.
**Light remains the product default** (`layout.tsx` pins `className="light"`,
`defaultTheme="light"`) — a product-truth call recorded 2026-08-23, not taste:
Brazilian operations floors under fluorescent light, full shifts, 1366×768
laptops, text-dense queues read for hours. **Dark is the brand-canonical
scene**: the board is shot on #0D0F10, and dark runs the board's hexes
verbatim. One constraint from PRODUCT.md binds everything visual: the repo is
white-label by construction — brand name, logo and favicon come from `BRAND_*`
config at runtime, so no surface may hardcode "Vozko".

**Key characteristics:**
- Signal-green accent under dark ink, always — never white on the green.
- Graphite neutrals in one 200–213 hue band shared by both themes.
- Two faces, two jobs: Oxanium for titles and KPI numerals only, Inter for
  everything read at length.
- Dense operator registers: 14px body, 32px controls, 36px fields, tabular
  figures on every number.
- Trace-line/dot-matrix ornament confined to the periphery, token-coloured;
  its slow pulse is the one sanctioned loop and self-removes under
  `prefers-reduced-motion`.
- Every colour pair measured, not assumed (`scratchpad/contrast.mjs`).

## Colors

One graphite family, one green, four statuses — all HSL triples in
`src/app/globals.css` (`:root` / `.dark`).

| Token | Light | Dark | Role |
|---|---|---|---|
| `--background` | `200 24% 97%` | `200 10% 6%` (#0D0F10) | Canvas |
| `--card` | `0 0% 100%` | `210 12% 9%` (#14181B; user-darkened so card-heavy pages read black) | Sheet |
| `--sidebar-background` | `0 0% 100%` | `200 10% 6%` (#0D0F10) | App chrome (bar + spine; shares the canvas value, hairline-separated) |
| `--muted` | `204 16% 93%` | `210 10% 12%` (≈ the board's #1A1D20 chip) | Quiet fill / track |
| `--foreground` | `206 15% 9%` | `210 15% 96%` | Default text |
| `--muted-foreground` | `206 9% 38%` | `213 7% 64%` | Secondary text |
| `--border` / `--border-strong` | `204 14% 88%` / `205 12% 76%` | `210 10% 19%` (#2C3136) / `211 8% 30%` | Hairline / field edge |
| `--primary` (+hover/active) | `164 100% 38%` (33/29) | `164 100% 41%` (46/35) | Brand fill |
| `--primary-foreground` | `200 10% 6%` | `200 10% 6%` | **Dark** ink on the green |
| `--primary-subtle` | `163 60% 94%` | `166 45% 12%` | Selected ground |
| `--primary-ink` | `165 100% 24%` | `163 88% 48%` | Accent **text** |
| `--healthy` / `--healthy-ink` | `152 90% 27%` / `152 95% 22%` | `152 65% 44%` / `152 60% 55%` | Positive |
| `--warning` / `--warning-ink` | `42 96% 45%` / `32 94% 29%` | `42 94% 55%` / `42 96% 62%` | Caution |
| `--destructive` / `--destructive-ink` | `352 74% 44%` / `352 78% 38%` | `352 78% 52%` / `353 90% 72%` | Fault |
| `--info` / `--info-ink` | `210 90% 42%` / `211 92% 34%` | `206 90% 60%` / `206 92% 70%` | Informational |
| `--ring` | `164 100% 38%` | `164 100% 46%` | Focus |
| `--chart-1..5` | `164/231/43/199/321` | `164/229/44/200/320` | Data series |
| `--plate-1..5`, `--plate-neutral` | deepened fills | deepened fills | Grounds for a white glyph |

**The Green Rule.** #00D09A carries **dark ink, never white**. The board's own
primary button is dark-on-green, and it measures: green vs #0D0F10 = 9.6:1;
green vs white = **2.0:1** — an outright failure. `--primary-foreground` is
near-black in *both* themes. Dark runs the board hex exactly (its label
measures 9.64:1); light holds the fill vivid at L38 — a user call
(2026-08-24, L32 read too dark) — so the dark label carries the contrast
(8.27:1) and the fill edge on white is accepted at 2.31:1. The rule reaches
every green surface: button labels, checked switch thumbs
(`bg-primary-foreground`), the `.tile-brand` glyph.

**The Two-Greens Rule.** With a green brand, healthy is the colour most at
risk of collapsing into the accent. It sits at hue **152** — yellower, deeper —
so a success chip and a commit button are never the same value, and status
never rests on colour alone: every status ships with a glyph and a label. (The
board's own "Sucesso" mark is brand green; the hue step is what keeps the
family resemblance from becoming ambiguity.)

**Every semantic colour ships as a FILL and an INK.** The fill is tuned to
carry its own `-foreground` as a solid; the ink is the text value for a label
on a neutral ground. All four status inks measure ≥5.4:1 on `--muted` in both
themes. Warning still never carries white (`--warning-foreground` is
near-black in light).

**Focus owns the brand.** `--ring` is the green; commit, selection and focus
are the accent's only three jobs. In dark it runs brighter than the fill (L46)
because a halo has to register against a near-black ground.

**Colour is a MARK, never a wash behind its own hue.** Carried intact from the
previous identity, still the hardest rule in the system: no 10–15% tint of a
hue under text in a darker shade of that same hue, and no prop-coloured
saturated block under a white glyph. Tiles (`.tile-*`) put the status in the
glyph on one known ground; notices (`.notice`) keep one opaque `--muted`
ground and spend the hue on the mark and title line; status chips whose pair
is token-known render as solid fills with their measured foregrounds
(`bg-healthy text-healthy-foreground`).

**Charts lead with the brand.** A green-brand product charts its own numbers
in its own colour: `--chart-1` is the brand green (board hex in dark), series
2–5 are the four validated non-brand hues from the 2026-08-19 CVD pass, their
pairwise geometry preserved by the green swap. Amber (`chart-3`) sits below
3:1 on white by the nature of yellow — every chart using it carries direct
labels or a legend. `--plate-1..5` stay decoupled from the series: a series
mark is tuned to be told apart from its neighbours, a plate is tuned to carry
white ink at ≥3:1 in its own theme.

**Series colour follows the ENTITY, and the mappings are pinned.** After green
took slot 1, the dashboards re-pinned rather than reflowed:
`admin-metrics-dashboard.tsx` maps users → `chart-2` (indigo), campaigns →
`chart-3`, calls → `chart-4`, WhatsApp → `chart-1` (green), email → `chart-5`,
with event pairs sharing the entity hue at 0.55 alpha for the terminal
variant; `admin-financial-dashboard.tsx` agrees (whatsapp_campaign 1, AI 5,
voice calls 4, top-ups 3). The campaign stage palette is a shared semantic
record — pending `--plate-neutral`, sent `chart-4`, delivered `chart-2`, read
`chart-1`, failed `--destructive` — repeated verbatim in `MonitoringMode.tsx`
and `WhatsAppCampaignDetail.tsx`; the terminal success stage is the one that
earns the brand green.

**Contrast is measured, not assumed.** 18 token pairs per theme, 36 checks in
all, **all pass** (`bun scratchpad/contrast.mjs`, re-run while writing this
document). The tightest are dark `destructive-foreground` on its fill at
**4.53:1** — why dark `--destructive` sits at L52 — and light `primary-ink` on
the selected-row tint at **4.86:1**.

## Typography

**Display Font:** Oxanium (variable 200–800, `latin` + `latin-ext`), falling
back to Inter
**Body Font:** Inter (variable, `latin` + `latin-ext`), with `Segoe UI
Variable Text` / `Segoe UI` high in the stack for the Windows floor
**Character:** A squared techno voice for titles over a neutral workhorse for
everything else — the board's own pairing ("INTER / REGULAR: textos /
informações"; the display register is "Títulos / Destaques").

Oxanium stands in for the board's literal wordmark face (Orbitron), which
ships no `latin-ext` subset and one style axis: a title in pt-BR, de or es
could drop to a fallback mid-word. Oxanium keeps the squared skeleton with
full four-locale coverage. Both load in `layout.tsx` as variable fonts
(`--font-inter`, `--font-oxanium`); `font-display` in `tailwind.config.ts`
resolves to Oxanium.

### Hierarchy
- **Page title** (`font-display`, 20px/600, `tracking-[0.01em]`):
  `DashboardPageHeader`, called from 77 pages. Oxanium is semi-wide, so the
  negative Inter tracking comes off.
- **Section title** (`font-display`, 16px/600, `tracking-[-0.01em]`):
  `PanelSection` heads.
- **KPI numeral** (`font-display` + `.readout`, 18–30px/600): the gauges in
  `page-shapes.tsx` (`ReadoutBar`, `InstrumentStrip`) and the dashboard
  overview.
- **Body / UI** (14px, `text-sm`): buttons, inputs, nav rows, table body.
  Always Inter.
- **Label** (`.legend`: 12px/600, sentence case, `-0.005em`,
  `--muted-foreground`): field labels, group heads, table heads. Casing comes
  from the i18n string, not CSS.
- **Micro** (11px, `text-2xs`): chips, captions, metadata.
- **Readout** (`tabular-nums`, `"tnum" 1`): every number (~81 sites).

**The Display Budget Rule.** `font-display` covers the whole title register
system-wide (user direction 2026-08-24): the shared overlay title primitives
(`ui/dialog`, `ui/drawer`, `ui/alert-dialog`, `elevated-dialog`,
`elevated-sheet`), page/section/card titles and KPI numerals across ~74 page
and component files (~197 elements, applied by a swept rollout with per-site
judgment). The floor is unchanged and enforced: nothing below `text-base`
takes the face — a techno face at 14px in a queue an attendant reads for a
shift is a legibility tax, so body, controls, tables, labels and `text-sm`
headings stay Inter.

**Density:** the root font scales 92% at 1024–1440px and 96% to 1599px
(`globals.css`), landing body at ~12.9px on the ops-floor laptops without
breaking the rem scale.

**Icons:** Tabler via the shim at `src/components/icons/index.tsx` (~269
exported names) — import from `@/components/icons`, never from
`@tabler/icons-react` directly. Stroke pinned at 1.6; the legacy `weight` prop
is accepted and ignored. `icons/channel-logos.tsx` keeps WhatsApp, Instagram
and Telegram in their real brand colours and is excluded from every sweep.

## Layout

**The bar owns the corner.** The app bar is full-width
(`fixed inset-x-0 top-0 z-40 h-12`, `elevated-design/dashboard/
dashboard-navbar.tsx`), carrying the brand/workspace identity line; the nav
spine starts below it (`fixed top-12 z-30`, widths 208 open / 52 rail from
`sidebar-context.tsx`). Content margin must equal the spine's rendered width
or full-bleed views (CRM, live chat) show a gap. The THESIS block's "FIRST
VIEWPORT" line was corrected during this build's finish pass to describe this
bar-owns-corner topology.

**Page anatomy** (`DashboardPageHeader`): breadcrumb trail (derived from the
pathname) or an explicit back affordance → Oxanium title with a quiet
18px glyph in `--muted-foreground` (no accent tile — it would appear on all 77
pages) → one-line description → the command bar, actions racked LEFT under
the title → a hairline closing the block.

**Panels are one surface, not stacked cards** (`PanelSection`): a section head
— title, optional description, actions — over a hairline, content directly on
the panel. The group legend rides as **right-aligned meta in the head, never
as an eyebrow above the heading**; `boxed` opts a genuinely separate object (a
danger zone) back into its own well.

**List pages take one of three shapes** (`console/page-shapes.tsx`), chosen by
what the data is, not by habit: `ReadoutBar` (ledger — one engraved line of
legend/readout pairs above a dense table), `InstrumentStrip` + `StatusRail`
(roster — the status counts *are* the filters, proportion bars at each bank's
foot), `GalleryGrid` (few items whose identity beats their fields; cells
divided by a shared 1px `bg-border` field, never per-card borders). None of
them draws a box around a number.

**Touch floor:** below `sm`, every button/select gets `min-height: 34px` from
`globals.css` unless it opts out with `data-dense`; Radix
checkbox/radio/switch keep their geometry and take the target from an
invisible centred 34px hit box instead.

## Workflow editor

The builder speaks the same language as the rest of the product
(2026-08-24 pass):

- **n8n-layered panels.** Selecting a node opens the THREE-PANE NDV
  (`z-[70]`, `bg-black/50` scrim, ESC/scrim-click close, `role="dialog"`):
  an "Entrada" pane (upstream connections) and a "Saída" pane (output
  branches + downstream nodes) sit recessed at the sides, and the config
  card floats IN FRONT — taller, `shadow-2xl`, overlapping their inner
  edges. The simulator (`workflow-test-panel`) is a centered dialog in the
  same shell. The node palette is a page-layer side sheet at `z-40`, always
  beneath the dialogs.
- **The copilot is a floating assistant**: a round `bg-primary` FAB at the
  bottom-right expanding into a bounded floating chat card
  (`w-[min(420px,92vw)] h-[min(68vh,620px)]`, `z-[60]`) so the canvas stays
  visible while it works; collapse keeps the session mounted, and its empty
  state carries the quiet trace ornament.
- **Nodes are sheets**: `bg-card border-border rounded-lg`, hover
  `border-border-strong`, selected `border-primary ring-2 ring-primary/30`;
  category identity rides the plate tokens with white glyphs (`condition`
  maps to `--info`, disambiguated by glyph + label).
- **Handles are the brand's trace pads**: 9px squares (`rounded-[2px]`,
  `border-2 border-border-strong bg-card`), going `border-primary` while
  connecting and `bg-primary` when valid — the board's square trace
  terminals, functional. The drag-to-connect cursor puck is the same pad.
- **Edges are vivid traces**: rest `border-strong` @ 2px, selected/on-path
  `--primary` @ 2.5px, dash-flow animation kept; the canvas dot grid and the
  run-drawer minimap ride tokens.
- WhatsApp message previews inside nodes keep WhatsApp's own palette on
  purpose (they simulate the recipient's app); the chrome around them is
  tokens.

## Charts

One grammar, one module: `src/components/charts/vozko.tsx` exports the whole
chart language and every graph in the product consumes it (dashboard home,
attendance, live-ops, campaign monitoring, both admin dashboards, the CRM
path chart, link stats, and the `elevated-charts` module).

- **Lines are the brand's traces**: 2.5px (`vozLineMark`), no resting dots, a
  card-ringed hover dot; area fills dissolve via `<VozAreaGradient>`
  (0.28 → 0.02), never a flat wash.
- **Chrome recedes**: horizontal dashed hairlines on `--border` only
  (`vozGrid`); axes carry no line/ticks, just 11px muted labels
  (`vozXAxis`/`vozYAxis`).
- **Radial means ring, never pie** (full reshape 2026-08-24): a single value
  is `<ProgressRing>` (the board's 75% element — rounded arc over a
  `--muted` track, display-face centre) or `<RadialGauge>` for half-circle
  scores; a composition is a thin segmented ring via `vozRing(outer,
  inner≈outer−12)` — card-coloured gaps, 3px corner radius. Wedge pies are
  retired product-wide.
- **Bars**: rounded value-ends `[4,4,0,0]` (or `[0,4,4,0]` horizontal),
  `maxBarSize` 28; stacked segments separated by a 1px card stroke, only the
  outermost segment rounds.
- **Palette**: `--chart-1..5`, entity-pinned, validated by the dataviz
  six-checks 2026-08-24 (both themes pass CVD ≥ 8 and normal-vision floors;
  light amber sits under 3:1 on white, so amber charts must keep direct
  labels/legend — they do). Dark series-1 keeps the board hex #00D09A above
  the generic dark lightness band: a brand-pinned exception, mitigated by
  thin marks and low-alpha fills. Text never wears a series colour.
- **Tooltips**: popover material — `border-border bg-popover shadow-md`,
  muted name, `readout font-semibold` value.

## Elevation & Depth

Layered shadows over surface steps — never bevels, gradients-as-material, or
glows. Every `--elev-1..6` step is two shadows: a tight near-opaque contact
shadow that draws the edge, and a wider ambient one that gives it a room to
sit in. In light both are tinted desaturated slate (`hsl(206 30% 22%)`) —
pure black over a cool canvas goes grey and dirty. **In dark, elevation is
carried by lightness first and shadow second**: sheets step UP (canvas 6% →
sheet 11% → popover 13%) and the shadows go plain black at higher alpha,
because a tinted shadow has no lightness left to remove.

### Shadow Vocabulary
- **sm → 2xl** (`--elev-1..6` via `tailwind.config.ts`): the resting-to-modal
  ramp; `.well` = sheet + `--elev-2`.
- **button** (`--elev-button`): drop shadow *plus* an inset bottom rule — the
  single dark line under a fill that makes it read as a pressable key.
- **quiet** (`--elev-button-quiet`): the secondary button's 1px border drawn
  AS the first shadow layer (`0 0 0 1px`) so border and elevation compose.
- **inner**: a genuine inset for deliberate recesses (progress tracks), not a
  resting state.

**The Flat-Field Rule.** Fields cast no shadow at rest
(`elevated-input.tsx` maps every variant's shadow to `none`): a field sits ON
the sheet and its hairline bounds it — which also leaves the box-shadow slot
free for the focus underline.

## Shapes

A real radius ramp, remapped at the scale in `tailwind.config.ts` so ~1,030
`rounded-[--radius]` and ~1,440 `rounded-{lg..3xl}` call sites moved worlds
unedited: **4 / 6 / 8 / 10 / 12 / 16px**. 6px (`--radius`) is THE control
corner — buttons, fields, chips, menu rows; the board's controls sit visibly
rounder than the Fluent 4px this replaces, without going pill. 8px on panels
and bubbles, 10–16px on large containers and overlays. `full` only for the
genuinely circular: avatars, dots, spinners, switch thumbs, and the `.lamp`
selection bar (3×16px, pinned to the leading edge of the active row). Nothing
renders at a 0px corner except genuine panel splits.

**The Ornament Rule.** The board decorates with exactly two devices and so
does the product: a **dot matrix** of square dots dissolving toward the
right (`.bg-dot-matrix` utilities, or the drawn `DotMatrix`) and **trace
lines** — a bundle of parallel 45° rising runs, the lead line stepping once
mid-climb, a dotted diagonal tail past its end, small square pads on the
faint runs (`CircuitTraces`, plus `CircuitTracesWide` recomposed on a
460×150 canvas with `preserveAspectRatio="xMaxYMid meet"` so it self-fits
wide short bands without clipping a stroke), and its SECOND type,
**circuit-board routing** (`CircuitBoard`): long orthogonal runs joined by
45° chamfered bends, a branch off the main route, square vias at junctions
and pads at ends — the board's identity-tile grammar. All in
`src/components/brand/circuit.tsx`, same tone/pulse API. They are identity, not information:
`aria-hidden`, `pointer-events-none`, coloured by `currentColor` through the
dedicated `--ornament` token (`text-ornament/NN`) — DEEPER than the brand
fill in light (164 100% 30%, because an alpha-faded L38 dissolves into
white) and the board hex in dark; the working register is /40–/60 in light,
/25–/45 in dark — and never behind text an operator reads for a shift. Homes today: the login/register/forgot-password/invite plates, the
page header's empty right band (`CircuitTracesWide` in
`DashboardPageHeader`, hidden below `lg`), the table empty state
(`CircuitTraces`), the CRM no-conversation panel and the AI-chat empty
greeting (both `CircuitBoard`, the routing type) — not queue rows, not
toolbars.

**The pulse exception.** The traces carry a slow current — a bright dash
sweeping the lead lines' own geometry (`.vz-trace-pulse`, 8s linear, dash
16/84 over `pathLength=100`, offset −200/cycle so the loop is seamless).
This is a USER-DIRECTED exception to "nothing in the periphery loops"
(2026-08-24), scoped to stay one: only the ornament may loop, and under
`prefers-reduced-motion` the pulse overlay removes itself entirely, leaving
the static art.

## Components

**Buttons — two implementations, one grammar.** `ui/button.tsx` (cva:
`primary` / `destructive` / `secondary` / `outline` / `ghost` / **`link`**; 7
consumers) and `elevated-design/button.tsx` (the de facto standard, imported
by 133 files, with its legacy alias table and a `command` variant for the
page-head action racks). Both carry: a discrete rest/hover/pressed colour
ramp (`--primary` → `-hover` → `-active` — a pressed button is a different
colour, never a fade), `shadow-button` with the inset bottom rule,
`shadow-quiet` on secondary, flat neutral chip when disabled. Heights 28/32/40
(`ui`), with the 34px phone floor via `sm:` prefixes in `elevated`. Only
`primary`/`vsl`/`action`/`destructive` carry a fill — a screen with four
accent buttons has no primary action left. The **`link`** variant is the
board's "Botão de Texto": `text-primary-ink`, no box, underline arriving on
hover, `active:text-primary-active`.

**Fields.** The `elevated-input` / `elevated-textarea` / `elevated-select`
family IS the field system — there is no `ui/input.tsx`, `ui/textarea.tsx` or
`ui/select.tsx`. One recipe: white sheet (`bg-card`), `border-border-strong`
hairline, heights 32/36/40, label rendered above as a `.legend`. Focus is the
signature: a 2px brand underline drawn as an **inset shadow** (no layout
shift) plus a soft `ring-primary/15` halo. **Resting icons are
`text-muted-foreground` — a resting field is not commit, selection or focus,
so the green arrives only with the focus underline.** The `search` variant
keeps a quiet `bg-muted` fill for toolbars and whitens on focus.

**Switches.** `elevated-switch.tsx`: track `bg-primary` when checked,
`--muted-foreground`/0.42 when not; the thumb is the Green Rule at 20px —
**checked `bg-primary-foreground` (dark ink on the green), unchecked
`bg-foreground`** — never white-on-green. The three hand-rolled switches
(`CustomFieldManager`, `OpportunityDrawer`, `webhook-trigger-config`) match
this exactly.

**Tables.** `elevated-design/table/dashboard-table.tsx` (29 consumers): quiet
head fill over a `border-border-strong` rule, hairline row rules,
`hover:bg-muted`, `bg-primary-subtle` on a selected row, no zebra. There is no
`ui/table.tsx`.

**Status chips & notices.** No badge primitive in `ui/` — chips are composed
from tokens. Token-known pairs render solid (`bg-healthy
text-healthy-foreground` …); arbitrary user-picked colours (labels, tags)
render solid with `readableInkFor()` (`lib/utils`) choosing the ink by
luminance; `.notice` banners keep one opaque `--muted` ground with the hue in
glyph and title (`.notice-ink`). Glyph tiles: `.tile-*` (status in the glyph,
forced from the plate so ~200 icon-coloured call sites can't fight it),
`.tile-1..5` (category plates, always a white mark), `.ink-plate`/`.ink-1..5`
(quiet plate, series-coloured glyph). `onSurface()` in `page-shapes.tsx`
derives the readable foreground for any token fill.

**Segmented toggles.** `elevated-pill-toggle.tsx`: quiet track, selected
segment raised as a sheet on `shadow-sm`, labelled in brand ink — no accent
fill.

**Menus.** Rows inset and rounded (`rounded-[--radius]`, 30px), tint on
hover; overlay surfaces (`bg-popover`) take the 8px corner. No leading accent
stripes.

**The login plate** (signature surface, `app/[locale]/login/page.tsx`): one
`.well` — brand head over a hairline, Oxanium title, credential fields, a
full-width primary key — with the brand's circuitry at the screen's edges
(`CircuitTraces` bleeding in from the top-right corner, `DotMatrix` lower
left, both on `text-ornament` and hidden below `sm`). The slide-to-unlock gate is retired for an
always-armed submit: Enter in the password field submits, password managers
autofill, focus order is unbroken; `required` fields guard the empty submit
the gate was protecting against. Nothing enters, moves or fades.

**Motion.** 150ms default, symmetric ease for in-place change, decelerate
(`ease-panel`) for arrivals — state only, nothing in the periphery loops. The
two permitted loops report live work (kanban arrival pulse, `dot-pulse`
typing indicator). Entrance choreography stays retired product-wide. Honest
residue: `ui/dialog.tsx` still hardcodes `duration-200` (the 800ms CRM
transitions and 300–400ms stats-panel timings noted by the previous document
are gone).

## Do's and Don'ts

### Do:
- **Do** put dark ink on every green fill — `--primary-foreground` in both
  themes — the light-theme fill sits at L38 by user direction (edge 2.31:1
  on white, label 8.27:1), so never let the fill carry meaning without its
  sheet.
- **Do** spend the green only on commit, selection and focus; everywhere else
  it is a bar, dot, glyph or ink.
- **Do** measure any new colour pair with `bun scratchpad/contrast.mjs`
  before shipping it; extend the script rather than eyeballing.
- **Do** keep status at hue 152 (healthy), 42 (warning), 352 (fault), 210
  (info), each as a fill/ink pair, each paired with a glyph and label.
- **Do** pin chart colour to the entity (users `chart-2`, WhatsApp `chart-1`)
  and reuse the campaign stage record verbatim.
- **Do** keep ornament peripheral, on the themed `text-ornament` token, and
  `aria-hidden`; the trace pulse is the one sanctioned loop and must keep
  honouring `prefers-reduced-motion`.
- **Do** set titles and KPI numerals in `font-display` at the established
  registers; keep `.readout` on every number; let i18n strings carry casing.
- **Do** compose depth from the `--elev-*` stack; buttons take
  `shadow-button`/`shadow-quiet`.

### Don't:
- **Don't** put white on #00D09A — it measures 2.0:1. This includes switch
  thumbs, tile glyphs and chart labels.
- **Don't** let success surfaces borrow the brand green, or the brand borrow
  healthy's 152.
- **Don't** reach for glow, neon, gradient fills or `backdrop-blur` — the
  board's night-scene look is contrast on graphite, not bloom (0 blur hits in
  `src/`, keep it there).
- **Don't** wash a hue behind its own ink, or put a prop-coloured saturated
  block under a white glyph — neutral ground, status in the mark.
- **Don't** set Oxanium at body/control size or grow its five-file budget
  casually.
- **Don't** recolour channel brand marks (`icons/channel-logos.tsx` is
  excluded from every sweep) or hardcode "Vozko" in a shipped surface — brand
  is `BRAND_*` data, not code.
- **Don't** pair AI branding with call/dial iconography or imply AI-automated
  phone calls (PRODUCT.md boundary; human telephony iconography stays).
- **Don't** loop anything in the periphery beyond the sanctioned trace
  pulse, or reintroduce entrance choreography.

## Known Gaps

Measured against the working tree, not estimated.

- **The per-file craft pass is partial.** The token system, both themes and
  the shared components are fully replaced and verified; roughly 100 component
  and page files were never opened and judged by eye
  (`../UI_REDESIGN_TODO.md`, 103 unchecked items — the queue inherits from the
  Surface pass). They moved worlds through the remapped scales and sweeps:
  coherent, but "inherited correctly" is not "designed."
- ~~Oxanium tabular figures~~ — verified, not a gap: Oxanium's digits are
  equal-width by design (measured in the running app 2026-08-24: `1111111`
  and `8888888` both 98px at 24px/600, with and without `"tnum" 1`), so
  `.readout font-display` numerals hold column width as they tick.
- **CDN brand assets still show the previous logo colours.** `BRAND_LOGO_URL`
  and the favicon come from brand config, out of this repo's control; the UI
  recoloured, the logo did not.
- **`text-white`: 91 hits remain** (down from 202). Every occurrence on a
  semantic fill was fixed in the sweeps; what remains sits on imagery, dark
  chrome or channel-brand surfaces and has not been audited case by case.
- **Slate/emerald residue:** ~29 `slate-*`/`emerald-*` references outside
  `channel-logos`, concentrated in the WhatsApp preview chrome (which
  deliberately imitates WhatsApp, not this product), tests, and dead
  `elevated-design` files; plus ~17 raw grey/green hexes in data and dead
  files.
- **Legacy aliases are still defined and referenced**: `--lamp`,
  `--lamp-ink`, `--rule-strong` resolve to the new brand/hairline tokens;
  `--shadow-highlight[-strong]` stay `transparent` for interpolated shadow
  strings.
- **Dead files were deliberately not deleted** ("design only, do not break
  functionality"): `auth/slide-to-unlock.tsx` now joins `grain-card`,
  `marquee`, `floating-path`, `chart-graphics` and the `pricing/*`/`faq/*`
  families — zero live render paths.
- **Adoption skew persists**: `ui/button.tsx` 7 consumers vs
  `elevated-design/button.tsx` 133. Same grammar in both, but still two files
  to keep in sync.

## Verification

| Check | Result | Provenance |
|---|---|---|
| `tsc --noEmit` | clean | re-run while writing this document |
| Contrast, 18 pairs × 2 themes | **36/36 pass** | `bun scratchpad/contrast.mjs`, re-run while writing this document |
| Direction contract in built output | **291** hits for seed `00d09a7f` in `.next` | re-counted while writing this document |
| `next build` | clean, **300** static pages | rebrand verification run, 2026-08-24 |
| Impeccable detector | **1** finding — false positive (`<img src>` in a doc comment in `app/actions/instagram.ts`) | rebrand verification run, 2026-08-24 |
| Entity/stage chart mappings | present as documented | read from `admin-metrics-dashboard.tsx`, `admin-financial-dashboard.tsx`, `MonitoringMode.tsx`, `WhatsAppCampaignDetail.tsx` |
| `backdrop-blur` in `src/` | **0** hits | re-counted while writing this document |
