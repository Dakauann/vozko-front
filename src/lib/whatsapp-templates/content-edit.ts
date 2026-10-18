import type { TemplateCategory, TemplateStatus, WhatsAppTemplate } from "./types";

const EDITABLE_STATUSES: readonly TemplateStatus[] = ["APPROVED", "REJECTED", "PAUSED"];

export const CONTENT_EDIT_CATEGORIES: readonly TemplateCategory[] = ["MARKETING", "UTILITY"];

export function contentEditable(template: Pick<WhatsAppTemplate, "status" | "category">): boolean {
  return EDITABLE_STATUSES.includes(template.status) && template.category !== "AUTHENTICATION";
}

export function categoryLockedOnEdit(status: TemplateStatus): boolean {
  return status === "APPROVED";
}
