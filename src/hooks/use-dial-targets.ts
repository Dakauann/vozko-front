"use client";

import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchDialTargets } from "@/app/actions/sip-trunks";
import { useWorkspace } from "@/contexts/workspace-context";
import { useCallReadiness, useMayPlaceCalls } from "@/hooks/use-call-readiness";
import { presetDial, requestCall } from "@/lib/call-session/call-session-control";
import { pickTrunk, rememberTrunk, useRememberedTrunk } from "@/lib/dialer/dial-lines";
import {
  DialTargetsError,
  callableNumber,
  dialBlocker,
  type DialBlocker,
  type DialTargetNumber,
  type DialTargets,
  type DialTrunk,
} from "@/lib/dialer/dial-targets";

const DIAL_TARGETS_STALE_MS = 15_000;
const UNAVAILABLE_RETRIES = 2;
const NO_TRUNKS: DialTrunk[] = [];

export interface UseDialTargetsOptions {
  leadId?: string | null;
  enabled?: boolean;
  refreshMs?: number;
  direct?: boolean;
  revision?: number;
}

export interface DialTargetsState {
  status: "idle" | "loading" | "ready" | "error";
  targets: DialTargets | null;
  number: DialTargetNumber | null;
  trunks: DialTrunk[];
  selectedTrunk: DialTrunk | null;
  blocker: DialBlocker | null;
  online: boolean;
  live: boolean;
  chooseTrunk: (trunkId: string) => void;
  presetTrunk: (trunkId: string) => void;
  call: () => boolean;
  numberBlocker: (number: string) => DialBlocker | null;
  callNumber: (number: string) => boolean;
}

type DialTargetsKey = readonly ["dial-targets", string, string, number | null];

function retryUnavailable(failureCount: number, error: Error): boolean {
  const unavailable = !(error instanceof DialTargetsError) || error.failure === "unavailable";
  return unavailable && failureCount < UNAVAILABLE_RETRIES;
}

export function useDialTargets({
  leadId = null,
  enabled = true,
  refreshMs,
  direct: alwaysDirect,
  revision,
}: UseDialTargetsOptions = {}): DialTargetsState {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? "";
  const permitted = useMayPlaceCalls();
  const lead = leadId?.trim() || null;
  const active = enabled && permitted && workspaceId !== "";

  const queryKey: DialTargetsKey = ["dial-targets", workspaceId, lead ?? "", revision ?? null];
  const query = useQuery<DialTargets, Error, DialTargets, DialTargetsKey>({
    queryKey,
    queryFn: ({ signal }) => fetchDialTargets(lead, signal),
    enabled: active,
    staleTime: DIAL_TARGETS_STALE_MS,
    refetchOnWindowFocus: false,
    refetchInterval: active && refreshMs ? refreshMs : false,
    retry: retryUnavailable,
    placeholderData: (previous, previousQuery) => (previousQuery?.queryKey[1] === workspaceId ? previous : undefined),
  });

  const [presetTrunkId, setPresetTrunkId] = useState<string | null>(null);
  const rememberedTrunkId = useRememberedTrunk(workspaceId);

  const shown = active ? (query.data ?? null) : null;
  const targets = query.isPlaceholderData ? null : shown;
  const trunks = shown?.trunks ?? NO_TRUNKS;
  const selectedTrunk = pickTrunk(trunks, presetTrunkId, rememberedTrunkId);
  const number = lead && targets ? callableNumber(targets) : null;
  const direct = alwaysDirect ?? (lead === null || trunks.length === 1);
  const { online, live, blocker: readiness } = useCallReadiness({ direct });

  const status: DialTargetsState["status"] = !active
    ? "idle"
    : query.isError && !targets
      ? "error"
      : targets
        ? "ready"
        : "loading";
  const failure = query.error instanceof DialTargetsError ? query.error.failure : null;
  const blockerFor = (dialed?: string): DialBlocker | null =>
    dialBlocker({
      readiness,
      status: status === "idle" ? "loading" : status,
      failure,
      targets,
      linesOnly: lead === null,
      number: dialed,
    });
  const blocker = blockerFor();

  const chooseTrunk = useCallback(
    (trunkId: string) => {
      setPresetTrunkId(null);
      rememberTrunk(workspaceId, trunkId);
    },
    [workspaceId],
  );

  const dial = (dialed: string): boolean => {
    if (!lead) return false;
    if (trunks.length === 1) {
      const [only] = trunks;
      requestCall({ phoneNumber: dialed, trunkId: only.id, label: only.name, leadId: lead });
      return true;
    }
    presetDial({
      phoneNumber: dialed,
      ...(selectedTrunk ? { trunkId: selectedTrunk.id } : {}),
      leadId: lead,
      ...(revision !== undefined ? { leadRevision: revision } : {}),
    });
    return true;
  };

  const call = (): boolean => (blocker || !number ? false : dial(number.number));
  const callNumber = (dialed: string): boolean => (blockerFor(dialed) ? false : dial(dialed));

  return {
    status,
    targets,
    number,
    trunks,
    selectedTrunk,
    blocker,
    online,
    live,
    chooseTrunk,
    presetTrunk: setPresetTrunkId,
    call,
    numberBlocker: blockerFor,
    callNumber,
  };
}
