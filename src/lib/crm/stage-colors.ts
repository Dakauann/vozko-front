/**
 * The colours a stage can carry on the board.
 *
 * One list, because a stage created in the CRM's quick manager and one drawn in
 * the funnel composer are the same object and must not offer different palettes.
 * They were two copies of these twelve hexes until this file existed.
 *
 * They are raw hexes rather than tokens on purpose: a stage colour is DATA the
 * operator picked and the server stores, not a themed surface. The UI reads it
 * back through `readableInkFor()` so the label stays legible on whatever was
 * chosen, in either theme.
 */
export const STAGE_COLORS = [
    "#3B82F6", // blue
    "#10B981", // emerald
    "#F59E0B", // amber
    "#EF4444", // red
    "#8B5CF6", // violet
    "#EC4899", // pink
    "#06B6D4", // cyan
    "#F97316", // orange
    "#84CC16", // lime
    "#6366F1", // indigo
    "#14B8A6", // teal
    "#A855F7", // purple
] as const;

/**
 * The colour a newly added stage takes: the next one in the list, so a funnel
 * built in one sitting comes out legible instead of twelve shades of blue.
 * Wraps rather than repeating the last one.
 */
export function nextStageColor(usedColors: string[]): string {
    const used = new Set(usedColors.map((c) => c.trim().toUpperCase()));
    const free = STAGE_COLORS.find((c) => !used.has(c.toUpperCase()));
    return free ?? STAGE_COLORS[usedColors.length % STAGE_COLORS.length];
}
