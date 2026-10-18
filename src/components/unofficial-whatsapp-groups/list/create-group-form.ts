import type { CreateGroupPayload } from "@/lib/unofficial-whatsapp-groups/types";

export const GROUP_NAME_MAX_CHARS = 25;

export const GROUP_DESCRIPTION_MAX_CHARS = 512;

export interface CreateGroupForm {
  name: string;
  description: string;
  category: string;
  instanceIds: string[];
  adminsOnly: boolean;
  follow: boolean;
}

interface CreateGroupIssues {
  name?: "required" | "tooLong";
  description?: "tooLong";
  numbers?: "required";
}

export function createGroupIssues(form: CreateGroupForm): CreateGroupIssues {
  const issues: CreateGroupIssues = {};
  const name = form.name.trim();
  if (!name) issues.name = "required";
  else if (name.length > GROUP_NAME_MAX_CHARS) issues.name = "tooLong";
  if (form.description.trim().length > GROUP_DESCRIPTION_MAX_CHARS) issues.description = "tooLong";
  if (form.instanceIds.length === 0) issues.numbers = "required";
  return issues;
}

export function hasIssues(issues: CreateGroupIssues): boolean {
  return Object.keys(issues).length > 0;
}

export function createGroupPayload(form: CreateGroupForm): CreateGroupPayload {
  const description = form.description.trim();
  const category = form.category.trim();
  return {
    name: form.name.trim(),
    ...(description ? { description } : {}),
    ...(category ? { category } : {}),
    instanceIds: form.instanceIds,
    adminsOnly: form.adminsOnly,
    skipFollow: !form.follow,
  };
}

export function numberRole(selected: readonly string[], id: string): "creator" | "admin" | undefined {
  const position = selected.indexOf(id);
  if (position < 0) return undefined;
  return position === 0 ? "creator" : "admin";
}

export function categorySuggestions(categories: readonly string[], typed: string): string[] {
  const text = typed.trim().toLowerCase();
  return categories.filter((item) => item.toLowerCase() !== text && (!text || item.toLowerCase().includes(text)));
}
