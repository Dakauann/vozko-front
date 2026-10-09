"use client";

import { useQuery } from "@tanstack/react-query";

import { listInstancesAction } from "@/app/actions/unofficial-whatsapp";
import { listBusinessPhonesAction } from "@/app/actions/whatsapp-business-phones";
import { useWorkspace } from "@/contexts/workspace-context";
import { useAccess } from "@/hooks/use-access";
import { leadSendStates, type LeadSendStates, type SendNumbersView } from "@/lib/leads/sends";

export const SEND_TEMPLATE_CAPABILITY = "leads.send_template";
export const SEND_UNOFFICIAL_CAPABILITY = "leads.send_unofficial";

const CONNECTED = "CONNECTED" as const;
const NUMBERS_STALE_MS = 60_000;

type SendChannelNumbers = "official" | "unofficial";

async function hasConnectedNumber(channel: SendChannelNumbers): Promise<boolean> {
  if (channel === "official") {
    const answer = await listBusinessPhonesAction({ status: CONNECTED, page: 1, pageSize: 1 });
    if (answer.error) throw new Error(answer.error);
    return answer.phones.length > 0;
  }
  const answer = await listInstancesAction(1, 1, undefined, CONNECTED);
  if (answer.error) throw new Error(answer.error);
  return answer.instances.length > 0;
}

function useConnectedNumbers(channel: SendChannelNumbers, wanted: boolean): SendNumbersView {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? "";
  const query = useQuery({
    queryKey: ["lead-send-connected-numbers", workspaceId, channel] as const,
    queryFn: () => hasConnectedNumber(channel),
    enabled: wanted && workspaceId !== "",
    staleTime: NUMBERS_STALE_MS,
    retry: false,
    refetchOnWindowFocus: false,
  });
  if (query.data !== undefined) return { connected: query.data };
  return query.isError ? "failed" : "loading";
}

export function useLeadSendGate(): LeadSendStates {
  const { decideCapabilities } = useAccess();
  const template = decideCapabilities([SEND_TEMPLATE_CAPABILITY]);
  const unofficial = decideCapabilities([SEND_UNOFFICIAL_CAPABILITY]);
  const numbers = {
    official: useConnectedNumbers("official", template === "granted"),
    unofficial: useConnectedNumbers("unofficial", unofficial === "granted"),
  };
  return leadSendStates({ template, unofficial, numbers });
}
