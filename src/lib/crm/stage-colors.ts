export const STAGE_COLORS = [
    "#3B82F6",
    "#10B981",
    "#F59E0B",
    "#EF4444",
    "#8B5CF6",
    "#EC4899",
    "#06B6D4",
    "#F97316",
    "#84CC16",
    "#6366F1",
    "#14B8A6",
    "#A855F7",
] as const;

export function nextStageColor(usedColors: string[]): string {
    const used = new Set(usedColors.map((c) => c.trim().toUpperCase()));
    const free = STAGE_COLORS.find((c) => !used.has(c.toUpperCase()));
    return free ?? STAGE_COLORS[usedColors.length % STAGE_COLORS.length];
}
