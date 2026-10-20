import type { CampaignType, WsSearchInboxPayload } from "./types";

export function needsServerList(payload: WsSearchInboxPayload): boolean {
  return Boolean(
    payload.query ||
      payload.stage_id ||
      payload.stage_name ||
      payload.label_id ||
      payload.channel ||
      payload.date_from ||
      payload.date_to ||
      payload.window_open !== undefined ||
      payload.has_unread !== undefined ||
      payload.is_group !== undefined ||
      payload.min_message_count ||
      payload.max_message_count ||
      payload.message_search ||
      payload.responsible_user_id ||
      payload.responsible_unassigned ||
      payload.responsible_kind ||
      payload.personal ||
      payload.sort === "waiting",
  );
}

export function inboxCanHaveGroups(campaignType: CampaignType | undefined): boolean {
  return campaignType !== "whatsapp";
}
