import type { UnofficialWhatsAppCampaign } from "./types";

export function showsReady(campaign: Pick<UnofficialWhatsAppCampaign, "status" | "readyToStart">, status: string = campaign.status): boolean {
  return status === "STOPPED" && campaign.readyToStart === true;
}
