import { apiClient } from "@/lib/api/browser-client";
import type { SmartCampaignView, SmartDefaults, SmartPolicy } from "@/lib/whatsapp-campaigns/smart";

type SmartCampaignResult = { view: SmartCampaignView | null; error: string | null; errorCode?: string };

async function smartRequest(campaignId: string, init: RequestInit): Promise<SmartCampaignResult> {
  const response = await apiClient<SmartCampaignView>(`/whatsapp/campaigns/${campaignId}/smart`, init);
  if (response.error) {
    return { view: null, error: response.error.message, errorCode: response.error.code };
  }
  return { view: response.data ?? null, error: null, errorCode: undefined };
}

export function getSmartCampaignAction(campaignId: string) {
  return smartRequest(campaignId, { method: "GET" });
}

export function saveSmartCampaignAction(campaignId: string, policy: SmartPolicy) {
  return smartRequest(campaignId, { method: "PUT", body: JSON.stringify(policy) });
}

export function removeSmartCampaignAction(campaignId: string) {
  return smartRequest(campaignId, { method: "DELETE" });
}

export async function getSmartDefaultsAction(departmentId?: string) {
  const query = departmentId ? `?departmentId=${encodeURIComponent(departmentId)}` : "";
  const response = await apiClient<SmartDefaults>(`/whatsapp/campaign-waves/defaults${query}`, { method: "GET" });
  if (response.error) {
    return { defaults: null, error: response.error.message };
  }
  return { defaults: response.data ?? null, error: null };
}

export type WaveProjection = { waves: { number: number; size: number; at: string }[]; truncated: boolean };

export async function projectSmartWavesAction(policy: SmartPolicy, contacts: number, startAt?: string | null) {
  const response = await apiClient<WaveProjection>("/whatsapp/campaign-waves/projection", {
    method: "POST",
    body: JSON.stringify({ policy, contacts, ...(startAt ? { startAt } : {}) }),
  });
  if (response.error) {
    return { projection: null, error: response.error.message };
  }
  return { projection: response.data ?? null, error: null };
}
