import type { WsSearchInboxPayload } from "@/lib/conversations/types";

export const RESPONSIBLE_UNASSIGNED = "__unassigned__";
export const RESPONSIBLE_AI = "__ai__";
export const RESPONSIBLE_WORKFLOW = "__workflow__";

type ResponsiblePayload = Pick<
  WsSearchInboxPayload,
  "responsible_user_id" | "responsible_unassigned" | "responsible_kind"
>;

/**
 * Turns the inbox "Responsável" select into search fields: the team queue,
 * what an AI agent or a workflow holds, or one member's conversations.
 */
export function responsibleFilterPayload(value: string): ResponsiblePayload {
  switch (value) {
    case "":
      return {};
    case RESPONSIBLE_UNASSIGNED:
      return { responsible_unassigned: true };
    case RESPONSIBLE_AI:
      return { responsible_kind: "ai" };
    case RESPONSIBLE_WORKFLOW:
      return { responsible_kind: "workflow" };
    default:
      return { responsible_user_id: value };
  }
}
