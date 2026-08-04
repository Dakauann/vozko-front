# DESIGN.md — Console, as built

This documents the design system actually in the repository, not the one the
comments aspire to. Where code and stated intention disagree, the code wins and the
disagreement is called out explicitly (§9–10). Paths and class names are copied
from source, not paraphrased. Primary source for the identity itself is the
direction-contract comment in `src/app/layout.tsx` (search `THESIS`) — emitted as a
real HTML comment specifically so it survives production builds and stays auditable.

## 1. Identity

**"Console"** — a mixing-desk channel strip taken as grammar, not texture. Enamel/
graphite panel ground, content recessed into paper wells, engraved hairline rules
instead of shadows, silkscreen caps legends, 2px radius, tabular figures on every
number, one orange lamp reserved for lit state and commit.

`layout.tsx`: *"Many labeled channels, one operator, every state lit and visible...
an attendant sitting eight hours should never hunt for a label or guess a state."*
Light-as-default is a product-truth call, not taste: Brazilian operations floors
under fluorescent light, full shifts, 1366×768 laptops, text-dense queues read hours.

Named retirements:

| Retired device | Recorded where |
|---|---|
| Hover-to-expand icon rail | `sidebar.tsx`: *"navigation that appears on approach cannot be scanned, only hunted"* |
| Floating rounded card on a shadow | `ui/card.tsx`: *"a drop shadow would put the surface back on top of the panel and undo it"* |
| Gradient accent tile behind page titles | `DashboardPageHeader.tsx`: *"spends the one signal the interface has on decoration, and it appeared on all 77"* |
| Backdrop-blur glass | Zero `backdrop-blur*` hits in `src/`. `ui/dialog.tsx`: *"looks like a pure white/black freeze when stuck open"* |
| Pill buttons | `elevated-design/button.tsx`: *"the loudest single tell of the outgoing identity"* |
| Inter | `layout.tsx`: Archivo has "a squarer, more mechanical skeleton than the neutral sans it replaces" |
| Staggered spring nav entrance | `sidebar.tsx`: *"made every navigation feel like the app was booting"* |
| Perpetual pulsing/gradient badges | `sidebar.tsx`: *"perpetual movement out there is a cost with no message"* |

## 2. Colour

All custom properties live in `src/app/globals.css` (`:root` / `.dark`), HSL triples:

| Token | Light | Dark | Role |
|---|---|---|---|
| `--background` | `40 7% 87%` | `220 9% 10%` | Chassis panel ground |
| `--foreground` | `220 14% 15%` | `40 10% 91%` | Default text |
| `--card` | `42 14% 97%` | `220 9% 13%` | Well surface |
| `--muted` | `40 8% 92%` | `220 8% 16%` | Sunk track (fields, toolbars, kanban bays) |
| `--muted-foreground` | `220 8% 37%` | `220 7% 60%` | Secondary text (see contrast note) |
| `--border` / `--rule-strong` | `40 7% 73%` / `40 8% 62%` | `220 8% 19%` / `220 8% 28%` | Standard rule / darker **top** edge of a well |
| `--primary` (+hover/active) | `17 100% 42%` (37/33) | `17 100% 42%` (48/36) | Lamp hue as **fill** (buttons) |
| `--lamp` | `17 100% 42%` | `17 100% 52%` | Lamp as **indicator** (nav pip, toggle mark) |
| `--lamp-ink` | `17 90% 33%` | `17 100% 62%` | Accent **text** only, tuned to clear AA |
| `--healthy` | `152 48% 32%` | `152 52% 46%` | Positive status |
| `--destructive` | `352 68% 44%` | `352 72% 56%` | Fault status |
| `--ring` | `192 82% 32%` | `192 78% 46%` | Focus — its own hue, never the lamp's |
| `--chart-1..5` | `192/152/38/262/352` | brighter, same hues | Series colour, deliberately not hue 17 |
| `--radius` | `2px` | `2px` | The single corner radius |

**`--primary` is a signal, not a text colour**: at L42 on a paper well it measures
4.36:1, under AA, so accent text uses `--lamp-ink` instead (darkened to L33 in light
mode, lightened to L62 in dark). **`--lamp`/`--primary` split only in dark mode**:
*"L52 is what makes a 3px indicator read as lit, but white on L52 measures 3.29:1 —
under AA for a 13px button label."* The indicator stays bright (`--lamp: 17 100%
52%`); the fill drops to `--primary: 17 100% 42%` (4.6:1 vs. white) — in light mode
both are `17 100% 42%`. **`--muted-foreground` moved L40→L37**: at L40 it was
*"5.65:1 on `--card` and exactly 4.50:1 on `--background` — sitting on the AA line
with no headroom"*; L37 gives 6.4:1 / 5.1:1. Healthy (152) and destructive (352) sit
far from lamp hue 17 so state is never confused with "lit"; charts avoid hue 17 too.
Channel brand marks are the one deliberate palette exception — see §9.

## 3. Typography

Single family: **Archivo**, variable, loaded in `layout.tsx`:

```ts
Archivo({ variable: "--font-archivo", subsets: ["latin","latin-ext"], axes: ["wdth"], display: "swap" })
```

`latin-ext` is required, not decorative — pt-BR, de, es all need it. Stack in
`tailwind.config.ts`: `var(--font-archivo), ui-sans-serif, system-ui, -apple-system,
Segoe UI, Roboto, Helvetica, Arial, sans-serif`. One family covers both registers by
pushing the `wdth` axis rather than pairing a display face — normal width for
body/data, `font-stretch: 112%` for the small tracked caps.

| Register | Spec | Where |
|---|---|---|
| **Legend** (`.legend`) | 10px / `line-height:1` / weight 600 / uppercase / `letter-spacing:0.14em` / `font-stretch:112%` / `--muted-foreground` | Nav family headers, table `<thead>`, breadcrumb. A label beside a control, never a kicker over a heading |
| **Readout** (`.readout`) | `tabular-nums`, `font-feature-settings:"tnum" 1`, `letter-spacing:0` | Every number — `TableCell`, kanban counts |
| **Body/UI** | 13px | Buttons, inputs, nav rows, table body |
| **Title** | 17px / semibold / `tracking-[-0.01em]` | `DashboardPageHeader` heading |
| **Small print** | 11px | Subtitles (workspace name subtext, product description) |

### Icons

**Tabler**, via a compatibility layer at `src/components/icons/index.tsx`.
Icons carry a large share of a product's signature, so the set changed with the
world: Tabler is a uniform-stroke, geometric, square-cornered family that reads
as instrument labelling, where the previous set was rounded and shipped six
switchable weights.

Import icons from `@/components/icons` — **never from `@tabler/icons-react`
directly**. The shim is what made a 305-file provider swap a one-file change:

- It exports the ~265 component names the app already used, so no call site
  changed.
- It accepts a `weight` prop and **ignores it**. Tabler has one weight; the
  ~2,300 `weight="fill"|"bold"|"regular"` props across the app keep compiling
  and simply stop having an effect. Rewriting them all would have been thousands
  of edits for no visual gain.
- It pins `stroke={1.75}` — Tabler's default 2 is a shade heavy beside 13px
  Archivo at the 14–18px sizes this UI actually renders at.
- It re-exports the `Icon` / `IconProps` / `IconWeight` types under their
  previous names.

Adding an icon: add the Tabler import and one `export const Name: Icon =
adapt(IconX)` line to the shim. The file is generated — see the alias map in the
header comment before hand-editing.

Channel brand marks are the exception and do **not** come from this set:
`src/components/icons/channel-logos.tsx` keeps WhatsApp, Instagram and Telegram
in their real brand colours, because those are product identity.

## 4. Space, radius, elevation

`--radius: 2px`. The architectural move: the Tailwind **scales themselves** were
remapped in `tailwind.config.ts`, not the call sites:

```
borderRadius: none 0 · sm 1px · DEFAULT/md/lg/xl var(--radius) · 2xl 3px · 3xl 4px · full 9999px
boxShadow: none/sm/DEFAULT/md → inset 0 1px 0 hsl(var(--rule-strong))
           lg/xl/2xl → real drop shadows (0 2px 8px -2px … / 0 4px 14px -4px … / 0 8px 24px -6px hsl(220 20% 4% / .28-.40))
```

The config comment cites *"roughly 1,600 call sites... hardcode `rounded-xl`,
`rounded-2xl`, `rounded-3xl`"* and *"383 call sites use the default shadow scale."*
Verified today: `rounded-{lg,xl,2xl,3xl}` (incl. directional variants) totals
**1,441**; bare `shadow-{sm,md,lg,xl,2xl,inner,none}` totals **~385–392** — same
order of magnitude, meaning the remap still converts call sites nobody touches.
`full` survives for genuine circles (avatars, dots, spinners, switch/checkbox thumbs
— 452 hits, §10); pill **buttons** are squared explicitly at both Button components.

**Elevation is inverted, not re-skinned.** `sm`/`DEFAULT`/`md` resolve to an inset
rule on resting surfaces (cards, rows, fields) — no drop at all. The mechanism is
`.well` in `globals.css`:

```css
.well { background: hsl(var(--card)); border: 1px solid hsl(var(--border));
  border-top-color: hsl(var(--rule-strong)); border-radius: var(--radius); }
```

A darker top edge is what sells the recess; `ui/card.tsx`, `ui/input.tsx`,
`ElevatedPillToggle`'s track, and `KanbanColumnShell` are all built on it. Hover
**deepens the cut** (adds an inset ring) rather than lifting (`shadow-presets.ts`).

`lg`/`xl`/`2xl` keep real depth wherever something genuinely floats: `ui/dialog.tsx`
(`shadow-lg`), `elevated-design/sheet.tsx` (`shadow-lg`), every ad hoc popover
(`shadow-xl`), the mobile drawer (`shadow-2xl`) — *"an overlay that does not
separate from the content under it is a usability bug, not a purity win."*
`--shadow-highlight[-strong]` stay defined as `transparent` (never deleted) so ~30
hand-written shadow strings elsewhere that still interpolate them stay valid.

## 5. State language

| State | Signal |
|---|---|
| Unlit | `text-muted-foreground`; lamp pip present but `opacity-0` |
| Hover | `hover:bg-muted hover:text-foreground` — ground brightens, no accent |
| Lit / current | `bg-muted` ground + `text-foreground font-semibold` + visible `.lamp` pip (3×12px). *"the lamp pip, a sunk ground and a brightened label — so it never rests on colour alone"* |
| Commit | `bg-primary text-primary-foreground`, stepping to `--primary-hover`/`--primary-active` |
| Focus | `ring-2 ring-ring` (hue 192) — *"must never be confused with the lamp, or a keyboard user cannot tell 'focused' from 'current'"* |
| Healthy | Hue 152, always with icon/label, e.g. `{ icon: Microphone, bg: "bg-healthy" }` (STT feature glyph) |
| Fault | Hue 352, `border-destructive/40 bg-destructive/10 text-destructive`, always with text |
| Disabled | `disabled:opacity-40 disabled:pointer-events-none`, uniform across Button/Input/Textarea/toggle |

The kanban arrival pulse (`KanbanColumnShell.tsx`) is the one place colour animates —
`borderColor` sweeps `border → lamp → border` over 0.7s, once, because it reports a
real state change rather than looping.

## 6. Layout & shell

Topology is inverted: a **full-height 208px spine owns the top-left corner**; a
**48px header bar starts beside it**, not above it. `sidebar.tsx`: *"most of what
makes this shell read as a different product before a single colour is judged."*

Constants, `src/contexts/sidebar-context.tsx`:
```ts
export const SPINE_WIDTH_OPEN = 208;
export const SPINE_WIDTH_RAIL = 52;
```
`DashboardMainContent`'s `marginLeft` must equal the spine's rendered width, or
full-bleed views (CRM, live-chat) show a visible gap. There is deliberately no
`HEADER_HEIGHT` constant: the bar is sized in rem (`h-12`), and `globals.css`'s
87.5%/93.75% density scaling between 1024–1600px means it renders ~42px there and
only 48px above 1600px. `dashboard-navbar.tsx` mirrors the spine width
(`isCollapsed ? "md:left-[52px]" : "md:left-[208px]"`) with the same 160ms
transition so both edges move together.

**Workspace selector lives at the spine head** (`WorkspaceSwitcher`, inside
`SpineHead`), not the header bar, because it scopes everything below it — every nav
row, count, permission. **Department switcher lives in the header bar** instead,
because it filters the current view rather than scoping the app.

Family grouping in the nav uses an engraved rule plus a `.legend` caption, not a
colour dot per family — colour is reserved for state. **Channel families are the
explicit exception**: `familyBrandIcon` maps whatsapp/instagram/telegram to their
real brand mark beside the legend text (§9).

The product switcher (Campaigns vs. Affiliate) only lights while its own menu is
open — a control, not a destination. The spine itself never slides in (it's
furniture, present on load); only the mobile drawer does, since arriving from
offscreen is what a temporary drawer should report.

## 7. Components

**Buttons — two parallel implementations.** `ui/button.tsx` (cva, variants
`primary/secondary/outline/ghost`) is the clean reference but has ~11 consumers.
`elevated-design/button.tsx` is the de facto standard at **136** consumers: a
`motion.button` with a legacy-alias table (`main-cta`, `vsl-cta` → `primary`/`vsl`).
Both square every corner; only `primary`/`action`/`vsl` carry the lamp fill. Its
`ghost` variant colours the icon with `text-[var(--text-lamp-ink)]` — undefined
anywhere (the real token is `--lamp-ink`), so the colour silently fails to apply.

**Cards.** `ui/card.tsx` is the well recipe verbatim: `rounded-[--radius] border
border-border border-t-rule-strong bg-card`. One live consumer; the same recipe is
hand-rolled elsewhere, e.g. `DashboardTable`'s wrapper (`rounded-2xl ... shadow-sm`,
remapping to the identical result).

**Fields.** `ui/input.tsx`/`ui/textarea.tsx`: `bg-muted` (sunk track, distinct from
`bg-card`), `border-border border-t-rule-strong`, `focus-visible:ring-2 ring-ring`.

**Tables.** `ui/table.tsx` documents the intended system — `.legend` heads on a
`rule-strong` rule, `.readout` cells, explicitly **no zebra striping** (*"the lit row
is the only thing... that should announce itself"*) — but has zero live consumers.
The real table, `elevated-design/table/dashboard-table.tsx` (36 consumers), gets
`text-lamp-ink` right for its selection count but hardcodes `text-white` instead of
`text-primary-foreground` on selected/active buttons, and its own zebra attempt —
`shouldBeDarker ? "bg-muted" : "bg-muted/200"` — is a no-op: `/200` opacity clamps to
the same rendered alpha as none. Same no-zebra outcome as `ui/table.tsx`, by accident.

**Badges.** `ui/badge.tsx`: bordered and quiet — default is `border-primary/40
bg-primary/10 text-lamp-ink`. A second, unrelated `elevated-design/badge.tsx` is a
pre-Console pill (`rounded-full`, six-layer soft shadow, `text-black/40`,
`font-inter`, default content `"FAQS"`) — imported once (`CrmMessageInput.tsx`) and
never rendered there: a dead import.

**Segmented toggles.** `elevated-pill-toggle.tsx` (9 consumers) is the real control:
a sunk track where the pressed key rises (`bg-card border-border`) and carries its
own lamp mark. Sibling `elevated-segmented-control.tsx` (3 consumers) wasn't
migrated: `rounded-xl`/dashed borders, a `vsl` variant still painting
`bg-gradient-to-r from-cyan-500/10 to-emerald-500/10`, and the same dead
`--text-lamp-ink` reference.

**Kanban bays.** `crm/KanbanColumnShell.tsx` is the single shared chrome for the
conversation funnel (pointer-drag) and deal board (native HTML5 drag) alike: resting
is `border-border border-t-rule-strong bg-muted`, drag-over is dashed
`border-rule-strong`, and a stage's colour survives as a 3px lamp-shaped tag on the
header rather than a dot.

**Overlays.** `ui/dialog.tsx`: scrim `bg-black/40` (never blur), content keeps
`shadow-lg`. `elevated-design/sheet.tsx`'s drawer matches it. Every ad hoc dropdown
converges on `border border-border border-t-rule-strong bg-popover shadow-xl`.

## 8. Motion

Tokens (`tailwind.config.ts`): `transitionDuration.DEFAULT = '120ms'`,
`transitionTimingFunction.DEFAULT/panel = 'cubic-bezier(.2,0,0,1)'`. The shell is
consistent with this: spine width/rail and content `marginLeft` animate at 160ms
with that curve, the header bar's left offset matches exactly so both edges stay
joined while the spine collapses, and the accordion runs at 0.16s. The mobile drawer
is intentionally asymmetric — 160ms in, 120ms out — so closing never feels sluggish.

Stated principle: *"State only... nothing in the periphery is allowed to move on a
loop; the accordion collapse survives because it reports a state change."* Deleted
under this rule: hover-expand rail, staggered spring nav entrance, perpetual badge
pulse/float/gradient-cycle. What survived and why: the kanban arrival pulse and the
accordion collapse — both one-time state reports, not loops.

**Honest gap:** the 120–160ms band is real in the navigation chrome but not swept
elsewhere. `ui/dialog.tsx`'s `DialogContent` hardcodes `duration-200` (unmodified
`tailwindcss-animate` default). `CrmInbox.tsx` and `CrmConversationView.tsx` include
800ms transitions; `AnalysisStatsPanel.tsx` runs several at 300–400ms. The rule held
where the identity was explicitly rebuilt; it wasn't retrofitted everywhere else.

## 9. Guardrails

- **No skeuomorphism** — no bevels, faux metal, gradients-as-material, knobs. Depth
  is only the engraved hairline plus a darker top edge, never highlight-plus-shadow.
- **Accent is state, not decoration** — reserved for "current"/"commit."
  `DashboardPageHeader` dropped its accent icon tile everywhere for this reason.
- **Channel brand marks keep their real colours** — the one deliberate palette
  exception. `icons/channel-logos.tsx`: WhatsApp solid `#25D366`; Instagram its real
  radial gradient (`#FDF497→#FD5949→#D6249F→#285AEB`); Telegram a
  `#2AABEE→#229ED9` circle with a white glyph. `weight`/`color` props are accepted
  and ignored on purpose: *"a brand mark that changes stroke weight or colour with
  the surrounding UI is no longer the brand mark."*
- **No backdrop-blur glass** — confirmed, zero `backdrop-blur*` hits in `src/`.
  Holds completely.
- **Voice iconography — the rule, stated correctly.** An earlier draft of this
  guardrail said "no waveform / microphone / record-light iconography anywhere."
  That is wrong, and the code is right to ignore it. PRODUCT.md's actual
  constraint is narrower: the product **does not offer AI voice calls**, and no
  surface may claim or imply AI-automated phone calls. Human telephony is a real,
  shipped product area — a dialer, transfers, call recordings, SIP trunks, call
  billing — plus voice notes and speech-to-text on messaging channels.

  So `Waveform` on `recordings/page.tsx` and the sidebar's Gravações row,
  `Microphone`/`MicrophoneSlash` as the mute toggle in `CrmCallWindow.tsx`, and
  the voice-note recorder in `CrmMessageInput.tsx` are all **accurate labels for
  features that exist**. Stripping them would make the interface less honest, not
  more.

  The rule that actually binds:

  1. Never pair AI branding (the `Sparkle` glyph, "IA"/"AI" wording, the agent
     family) with call/dial/phone iconography in the same control, tile or
     empty state. AI lives in messaging; voice is human tooling.
  2. Never render a live-call or record-light affordance as a *decorative*
     accent — a lone red pip over a filled handset reads as "recording now."
     `PersistentDialer`'s edge tab is the checkpoint: its state pip is
     `--healthy`/`--destructive`, never the lamp, and it always carries
     `connectionLabel` as text plus an `aria-label`.
  3. Copy never says or implies the product places or answers calls on its own.

## 10. Known gaps

```
grep -ro "rounded-full" --include='*.tsx' src/ | wc -l                                                  → 452
grep -roE "bg-(emerald|blue|sky|violet|purple|indigo|teal|cyan|amber|rose)-[3-7]00" --include='*.tsx' src/ | wc -l → 213
grep -ro "bg-gradient-to-" --include='*.tsx' src/ | wc -l                                                → 82
```

**452 `rounded-full`** — mostly legitimate: avatars, status dots, spinners, and the
`Switch`/`Checkbox` thumbs, already exempted by the radius-remap comment.

**213 raw saturated palette backgrounds** — survive mainly in bespoke per-page
markup, not shared primitives. `text-red-*`/`text-green-*` shows the same pattern:
~60 hits across ~40 page files (`workspace/page.tsx` alone has 26) instead of
`--destructive`/`--healthy`.

**82 gradients** — concentrated almost entirely in a pre-Console component family
predating the migration: `elevated-design/{pricing/*, faq/*, marquee.tsx,
gradient-text.tsx, floating-path.tsx, grain-background.tsx, grain-card.tsx,
chart-graphics.tsx}` (still `font-inter`, `text-black`, hand-tuned soft shadows).
Grepping for importers of these turns up **zero** for most — dead code — except
`GrainBackground` (one use: a whatsapp-campaign form) and `GradientText` (one use:
`settings/page.tsx`), leaking the old look into two live pages. No marketing site is
left to own that language either — `src/app/page.tsx` and `src/app/[locale]/page.tsx`
just `redirect` to `/login`.

**Dead variable.** `--text-lamp-ink` is referenced in three files (`button.tsx`,
`elevated-segmented-control.tsx`, `elevated-dialog.tsx` under `elevated-design/`) and
defined in zero — the real token is `--lamp-ink`.

**Dead/duplicate files.** `elevated-design/dialog.tsx` is a 0-byte empty file (the
real one is `ui/dialog.tsx`). `elevated-design/badge.tsx` has no live render path.

**Two switches disagree.** `ui/switch.tsx`'s checked state is `bg-primary` (the lamp
hue); `elevated-switch.tsx`'s is `bg-foreground` (plain neutral, not the accent), and
its disabled-checked state hardcodes `bg-gray-500` — a raw grey, no token behind it.

**Token discipline drift.** `text-white` appears 735 times, often standing in for
`text-primary-foreground` (`DashboardTable`'s selected/active buttons,
`WorkspaceSwitcher`'s create-workspace button, which also opacity-fades
`bg-primary/90` instead of stepping to `--primary-hover`).

**Adoption skew.** The `ui/*` primitives are the cleanest reference for every token
and are barely used: `ui/table.tsx` **0** consumers, `ui/checkbox.tsx` **0**,
`ui/card.tsx` **1**, `ui/input.tsx` **1**, `ui/badge.tsx` **1**, `ui/button.tsx`
**11** — versus `elevated-design/button.tsx` **136** and `.../dashboard-table.tsx`
**36**. The live dashboard is built from `elevated-design/*` plus bespoke per-page
markup, not `ui/*` — which is also where nearly all the raw-palette and gradient
survivors above actually live.

Net picture: semantic status colour is mapped to `--healthy`/`--destructive` in the
rebuilt shell chrome and shared primitives; decorative tiles mostly went neutral
there too. Outside that core, the old raw-palette, gradient, and Inter-flavoured
language survives in real numbers.
