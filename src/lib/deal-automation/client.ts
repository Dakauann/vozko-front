"use client";

import { apiClient } from "@/lib/api/browser-client";

export type DealAutomationContainerKind = "account" | "campaign";

export interface DealAutomationChannel {
  entryType: string;
  kind: DealAutomationContainerKind;
  containerId: string;
}

export interface DealAutomationSetting {
  pipelineId: string;
  enabled: boolean;
  updatedAt?: string;
}

function path({ entryType, kind, containerId }: DealAutomationChannel): string {
  return `/deal-automation/${encodeURIComponent(entryType)}/${kind}/${encodeURIComponent(containerId)}`;
}

export function getDealAutomation(channel: DealAutomationChannel) {
  return apiClient<DealAutomationSetting>(path(channel), { method: "GET" });
}

export function saveDealAutomation(channel: DealAutomationChannel, pipelineId: string) {
  return apiClient<DealAutomationSetting>(path(channel), {
    method: "PUT",
    body: JSON.stringify({ pipelineId }),
  });
}
