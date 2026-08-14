---
target: agent edit-mode chooser
total_score: 17
max_score: 36
na_heuristics: 9
p0_count: 2
p1_count: 2
timestamp: 2026-08-14T05-04-43Z
slug: dashboard-agents-agentid-edit-editagentclient-tsx
---
Method: dual-agent (A: design review · B: detector evidence). No browser (auth-gated app); source-only.

# Critique — Agent edit-mode chooser (EditAgentClient.tsx, pre-redesign)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Mode is invisible React state; no URL, no memory of last mode |
| 2 | Match System / Real World | 2 | Doors labeled by user skill ("Iniciante/Profissional"), not task |
| 3 | User Control and Freedom | 2 | Back/refresh loses mode; professional has no path back to guided |
| 4 | Consistency and Standards | 1 | Stale fork of the /new chooser; gradient tile vs .tile-* system |
| 5 | Error Prevention | 2 | No reassurance that guided editing preserves advanced config |
| 6 | Recognition Rather Than Recall | 3 | Bullets describe doors, but user must recall their last mode |
| 7 | Flexibility and Efficiency | 1 | Zero accelerators; every repeat edit pays the full-screen fork |
| 8 | Aesthetic and Minimalist Design | 1 | ~30 text elements + ribbon + accent chips for a two-way choice |
| 9 | Error Recovery | n/a | No error states exist on this screen |
| 10 | Help and Documentation | 3 | Bullets are competent inline help |
| **Total** | | **17/36** | **Poor (47%)** |

## Design Specificity Verdict
Category-interchangeable: generic SaaS plan-picker grammar (gradient tile, kicker, 2xl heading, bullets, CTA + arrow chip, "Recomendado" ribbon, framer hover lift). A stale fork of the /new chooser left behind when that one migrated to `.tile-*` plates. Detector: 0 findings on all three files; targeted grep confirmed line 274 `bg-gradient-to-br ${iconGradient} text-white` where iconGradient receives `.ink-*` glyph classes — no gradient stops exist, so the tile paints no background and the glyph is white-on-light: the exact "ghost square" DESIGN.md §9 bans (false positive: line 286 rounded-full is a legitimate 6px dot). Browser overlay skipped: auth-gated live backend, no browser tooling.

## Priority Issues
- **[P0] Broken banned icon tile** (line 273-277): transparent gradient + white glyph. Fix: `.tile-*` neutral plates, share the migrated card.
- **[P0] No memory, no default**: every edit pays the fork. Fix: remember last mode per agent; infer from agent config on first visit.
- **[P1] No responsive story** (line 104): three max-w-xl cards, no wrap — crush at 1366×768, unusable on mobile.
- **[P1] Invalid markup**: h2/p/ul inside `<button>`; flat accessible name; no focus-visible ring.
- **[P2] System violations**: 6px radius on large cards (ramp says 10-16), framer −4px lift (system is 1px, no reduced-motion), accent as decoration (ribbon + arrow chips).
- **[P2] pt-BR copy debt**: missing diacritics in chooser bullets; refine bullet claimed "voz" (brushes the no-AI-voice guardrail).

## Persona Red Flags
**Alex (power user)**: pays the chooser toll on every edit; ribbon recommends against his mode; no keyboard accelerator or memory. **Jordan (first-timer editing someone else's agent)**: forced skill self-assessment; no reassurance about whether either door preserves the agent's existing config.

## Questions
1. Why does edit-mode identity live in the user's self-image instead of the agent's record?
2. If guided editing can drop advanced config, isn't this chooser a data-loss dialog wearing marketing clothes?
3. With two destinations, is this a "choice" at all — or one editor with a complexity toggle?

## Recommended pattern (adopted, adapted to the user's page-based pin)
Selector stays a page (user requirement) but the remembered/inferred mode leads as the single marked row; both editors carry a quiet ElevatedPillToggle mode switch ("Guiado | Completo") in the header actions rack; tiles become .tile-* plates; cards become real links with focus rings on the radius ramp; copy is task-named, one line, properly accented, in all four locales.
