"use client";

import { useCallback, useEffect, useState } from "react";

import { getCarrierChannelsAction } from "@/app/actions/carrier-messaging";
import { useWorkspace } from "@/contexts/workspace-context";
import { isChannelLaunched, type CarrierChannels } from "@/lib/carrier-messaging/channels";
import type { CarrierChannel } from "@/lib/carrier-messaging/types";

export type CarrierChannelsStatus = "loading" | "ready" | "failed";

export interface CarrierChannelsState {
  status: CarrierChannelsStatus;
  launched: (channel: CarrierChannel) => boolean;
}

const pending = new Map<string, Promise<CarrierChannels | null>>();

function channelsFor(workspaceId: string): Promise<CarrierChannels | null> {
  const known = pending.get(workspaceId);
  if (known) return known;
  const request = getCarrierChannelsAction().then((answer) => {
    if (answer.error) {
      pending.delete(workspaceId);
      return null;
    }
    return answer.data;
  });
  pending.set(workspaceId, request);
  return request;
}

type Settled = { workspaceId: string; channels: CarrierChannels | null };

export function useCarrierChannels(enabled = true): CarrierChannelsState {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = enabled ? (currentWorkspace?.id ?? "") : "";
  const [settled, setSettled] = useState<Settled | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    let active = true;
    void channelsFor(workspaceId).then((channels) => {
      if (active) setSettled({ workspaceId, channels });
    });
    return () => {
      active = false;
    };
  }, [workspaceId]);

  const current = settled?.workspaceId === workspaceId ? settled : null;
  const channels = current?.channels ?? null;
  const launched = useCallback((channel: CarrierChannel) => isChannelLaunched(channels, channel), [channels]);
  const status: CarrierChannelsStatus = !enabled ? "failed" : !current ? "loading" : channels ? "ready" : "failed";
  return { status, launched };
}
