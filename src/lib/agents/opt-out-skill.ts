export const OPT_OUT_SKILL = "record_opt_out";

export function missingOptOutSkill<Tool extends { name: string }>(
  offered: readonly Tool[],
  selected: readonly { name: string }[],
): Tool | null {
  if (selected.some((binding) => binding.name === OPT_OUT_SKILL)) return null;
  return offered.find((tool) => tool.name === OPT_OUT_SKILL) ?? null;
}
