import { apiClient } from "@/lib/api/browser-client";
import type { TemplateHealth } from "@/lib/whatsapp-templates/health";

export async function getTemplateHealthAction(templateId: string): Promise<{ health: TemplateHealth | null; error: string | null }> {
  const response = await apiClient<TemplateHealth>(`/whatsapp/templates/${templateId}/health`, { method: "GET" });
  if (response.error) {
    return { health: null, error: response.error.message };
  }
  return { health: response.data ?? null, error: null };
}
