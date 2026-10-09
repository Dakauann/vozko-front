import type { LeadUpdateEvent } from "@/lib/leads/types";

export interface LeadFetched {
  version: number;
  applyFields: (fields: readonly string[]) => void;
}

export type LeadFetch = (leadId: string, fields: readonly string[]) => Promise<LeadFetched | null>;

interface LeadRefreshState {
  wanted: number;
  fields: Set<string>;
  again: boolean;
}

function takeFields(state: LeadRefreshState): string[] {
  const fields = [...state.fields];
  state.fields.clear();
  state.again = false;
  return fields;
}

export function createLeadRefresher(fetchLead: LeadFetch): (event: LeadUpdateEvent) => void {
  const running = new Map<string, LeadRefreshState>();

  const fetchOnce = async (leadId: string, state: LeadRefreshState): Promise<LeadFetched | null> => {
    try {
      return await fetchLead(leadId, takeFields(state));
    } catch {
      return null;
    }
  };

  const drain = async (leadId: string, state: LeadRefreshState) => {
    try {
      let fetched = await fetchOnce(leadId, state);
      while (state.again) {
        if (fetched !== null && fetched.version >= state.wanted) {
          fetched.applyFields(takeFields(state));
        } else {
          fetched = await fetchOnce(leadId, state);
        }
      }
    } finally {
      running.delete(leadId);
    }
  };

  return (event) => {
    const current = running.get(event.leadId);
    if (current) {
      current.wanted = Math.max(current.wanted, event.version);
      for (const field of event.fields) current.fields.add(field);
      current.again = true;
      return;
    }
    const state: LeadRefreshState = { wanted: event.version, fields: new Set(event.fields), again: false };
    running.set(event.leadId, state);
    void drain(event.leadId, state);
  };
}
