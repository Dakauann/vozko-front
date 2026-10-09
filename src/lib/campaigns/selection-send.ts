export const LEAD_SELECTION_SOURCE = "lead_selection";

const RESUMABLE_STATUS = "PAUSED";

export const SELECTION_SEND_REFUSALS = ["send_start_from_leads", "send_selection_locked"] as const;

export type SelectionSendRefusal = (typeof SELECTION_SEND_REFUSALS)[number];

export interface SelectionSendControls {
  fromLeads: boolean;
  start: boolean;
  reset: boolean;
  editContent: boolean;
}

export function selectionSendControls(source: string | undefined, status: string): SelectionSendControls {
  const fromLeads = source === LEAD_SELECTION_SOURCE;
  return { fromLeads, start: !fromLeads || status === RESUMABLE_STATUS, reset: !fromLeads, editContent: !fromLeads };
}

export function selectionSendRefusal(code: string | undefined): SelectionSendRefusal | null {
  return SELECTION_SEND_REFUSALS.find((refusal) => refusal === code) ?? null;
}
