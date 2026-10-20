import { pathForScreen } from "@/lib/navigation/routes";

const FALLBACK = "/dashboard";

export function formsListHref(): string {
  return pathForScreen("whatsapp_forms") ?? FALLBACK;
}

export function newFormHref(): string {
  return pathForScreen("whatsapp_form_new") ?? FALLBACK;
}

export function formDetailHref(formId: string, view?: string): string {
  const base = pathForScreen("whatsapp_form_detail", { formId }) ?? FALLBACK;
  return view ? `${base}?view=${encodeURIComponent(view)}` : base;
}

export function formBuilderHref(formId: string): string {
  return pathForScreen("whatsapp_form_builder", { formId }) ?? FALLBACK;
}

export function workflowHref(workflowId: string): string | null {
  return pathForScreen("workflow_detail", { id: workflowId });
}

export function responseRate(summary: { sent: number; responses: number }): number | null {
  return summary.sent > 0 ? (summary.responses / summary.sent) * 100 : null;
}
