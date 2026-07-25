/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { PhoneCall, PhoneDisconnect, WhatsappLogo } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import {
  setDialerCallActive,
  subscribeDialerCallRequest,
} from "@/lib/dialer/dialer-control";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ElevatedCommandSelect } from "../elevated-design/elevated-command-select";
import { IconBox } from "../elevated-design/listing-card";
import { DialerPresencePanel } from "./dialer/dialer-presence-panel";
import { IncomingTransferModal } from "./dialer/incoming-transfer-modal";
import { IncomingCallModal } from "./dialer/incoming-call-modal";
import { Input } from "@/components/ui/input";
import { SipTrunk } from "../../lib/sip-trunks/types";
import { TransferPanel } from "./dialer/transfer-panel";
import type { WorkspaceMember } from "@/lib/workspace/types";
import { cn } from "@/lib/utils";
import { listMembersAction } from "@/app/actions/workspace";
import { getWorkspaceConfigAction } from "@/app/actions/workspace-config";
import { listSipTrunksAction } from "../../app/actions/sip-trunks";
import { toast } from "sonner";
import { useDialerWs } from "@/hooks/use-dialer-ws";
import { usePanelWidth } from "@/hooks/use-panel-width";
import { useWorkspace } from "@/contexts/workspace-context";
import { useAuth } from "@/contexts/auth-context";

const KEYPAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "+", "0"];

function sanitizeDialPhone(value: string): string {
  let cleaned = value.replace(/[^\d+]/g, "");
  if (value.trim().startsWith("+")) {
    cleaned = `+${cleaned.replace(/\+/g, "")}`;
  }
  return cleaned;
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function isDialPhoneValid(phone: string): boolean {
  if (/^\+?[1-9]\d{7,14}$/.test(phone)) {
    return true;
  }
  return /^\d{3,6}$/.test(phone);
}

function NoTrunkOverlay({
  translator,
}: {
  translator: (key: "noTrunks") => string;
}) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="rounded-lg p-4 text-center flex gap-2 items-center">
        <IconBox>
          <PhoneDisconnect weight="fill" className="h-6 w-6 text-white" />
        </IconBox>
        <p className="text-sm text-foreground">{translator("noTrunks")}</p>
      </div>
    </div>
  );
}

function WhatsAppChannelIndicator({
  label,
  caption,
}: {
  label?: string;
  caption: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-emerald-500/40 bg-emerald-500/5 px-3 py-2">
      <WhatsappLogo
        weight="fill"
        className="h-4 w-4 shrink-0 text-emerald-500"
      />
      <span className="text-xs font-medium text-foreground">{caption}</span>
      {label ? (
        <span className="ml-auto truncate font-mono text-[11px] text-muted-foreground">
          {label}
        </span>
      ) : null}
    </div>
  );
}

export default function PersistentDialer() {
  const t = useTranslations("persistentDialer");
  const { user } = useAuth();
  const { currentWorkspace, can } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [dialPhone, setDialPhone] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [availableSipTrunks, setAvailableSipTrunks] = useState<SipTrunk[]>([]);
  const [selectedTrunkId, setSelectedTrunkId] = useState<string | null>(null);
  const [pendingRemoteDial, setPendingRemoteDial] = useState<{
    phoneNumber: string;
    sipTrunkId?: string;
    whatsAppPhoneId?: string;
    whatsAppPhoneLabel?: string;
  } | null>(null);
  const [activeWhatsApp, setActiveWhatsApp] = useState<{
    label?: string;
  } | null>(null);

  const canUseDialer = can("dialer", "use");
  const canTransferDialer = can("dialer", "transfer");
  const canListDialerMembers = can("dialer", "list_members");

  // The dialer is docked to the right edge; users can drag its left edge to
  // resize and the chosen width persists across sessions.
  const { width, startResize, resizing } = usePanelWidth("vozko:dialer:width", {
    def: 320,
    min: 300,
    max: 560,
  });

  const {
    status,
    callState,
    startCall,
    endCall,
    presence,
    selfUserId,
    outgoingTransfer,
    incomingOffer,
    incomingCall,
    refreshTransferTargets,
    initiateTransfer,
    acceptTransfer,
    declineTransfer,
    acceptIncomingCall,
    declineIncomingCall,
    completeAttended,
    cancelAttended,
  } = useDialerWs({
    // Session-presence signal for the dialer socket (auth rides the cookie); the
    // user id flips on login/logout.
    token: user?.id ?? "",
    enabled: !!currentWorkspace?.id && canUseDialer,
  });

  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [membersLoaded, setMembersLoaded] = useState(false);
  useEffect(() => {
    if (!currentWorkspace?.id) return;
    let cancelled = false;
    setMembersLoaded(false);
    listMembersAction(currentWorkspace.id).then((res) => {
      if (cancelled) return;
      if (!res.error) setMembers(res.members);
      setMembersLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [currentWorkspace?.id]);

  // Whether the workspace has the call queue enabled: this is what lets an agent
  // blind-transfer to a BUSY colleague (camp-on). Without it, busy targets stay
  // unselectable in the picker (classic behavior).
  const [queueEnabled, setQueueEnabled] = useState(false);
  useEffect(() => {
    if (!currentWorkspace?.id) return;
    let cancelled = false;
    getWorkspaceConfigAction(currentWorkspace.id).then((res) => {
      if (cancelled) return;
      setQueueEnabled(!!res.config?.queueEnabled);
    });
    return () => {
      cancelled = true;
    };
  }, [currentWorkspace?.id]);

  const initiatorName = useMemo(() => {
    if (!incomingOffer) return "";
    if (incomingOffer.initiatorId?.startsWith("ai:")) {
      return "Agente IA";
    }
    return (
      members.find((m) => m.userId === incomingOffer.initiatorId)?.username ??
      "Outro agente"
    );
  }, [members, incomingOffer]);

  const fetchAvailableSipTrunks = useCallback(async () => {
    try {
      const response = await listSipTrunksAction();
      if (response.error) {
        console.warn(
          "[PersistentDialer] Failed to list SIP trunks:",
          response.error,
        );
        setAvailableSipTrunks([]);
        setSelectedTrunkId(null);
        return;
      }
      // Only offer trunks you can actually dial out on: enabled AND currently
      // registered. An unregistered/failed trunk (e.g. its carrier registration is
      // timing out) cannot place a call, so listing or auto-selecting it just yields
      // failed dials. When none are healthy, the dialer shows the no-trunk overlay.
      const usable = (response.trunks ?? []).filter(
        (trunk) => trunk.enabled && trunk.registrationStatus === "registered",
      );
      setAvailableSipTrunks(usable);
      setSelectedTrunkId((prev) => {
        if (prev && usable.some((trunk) => trunk.id === prev)) return prev;
        return usable.length > 0 ? usable[0].id : null;
      });
    } catch (error) {
      console.error("Failed to fetch SIP trunks:", error);
    }
  }, []);

  useEffect(() => {
    if (callState?.status !== "answered" || !callState.answeredAt) {
      setElapsedSeconds(0);
      return;
    }

    const timer = setInterval(() => {
      setElapsedSeconds(
        Math.max(0, Math.floor((Date.now() - callState.answeredAt!) / 1000)),
      );
    }, 1000);

    return () => clearInterval(timer);
  }, [callState?.status, callState?.answeredAt]);

  useEffect(() => {
    if (currentWorkspace?.id && canUseDialer) {
      fetchAvailableSipTrunks();
    }
  }, [currentWorkspace?.id, canUseDialer, fetchAvailableSipTrunks]);

  useEffect(() => {
    if (!canUseDialer) return;
    return subscribeDialerCallRequest(
      ({ phoneNumber, sipTrunkId, whatsAppPhoneId, whatsAppPhoneLabel }) => {
        const cleanPhone = sanitizeDialPhone(phoneNumber);
        setOpen(true);
        setDialPhone(cleanPhone);
        if (sipTrunkId) setSelectedTrunkId(sipTrunkId);
        setPendingRemoteDial({
          phoneNumber: cleanPhone,
          sipTrunkId,
          whatsAppPhoneId,
          whatsAppPhoneLabel,
        });
      },
    );
  }, [canUseDialer]);

  const normalizedPhone = useMemo(
    () => sanitizeDialPhone(dialPhone),
    [dialPhone],
  );
  const canDial = useMemo(
    () => isDialPhoneValid(normalizedPhone),
    [normalizedPhone],
  );
  const hasActiveCall = callState != null && callState.status !== "ended";

  useEffect(() => {
    setDialerCallActive(hasActiveCall);
    return () => setDialerCallActive(false);
  }, [hasActiveCall]);

  useEffect(() => {
    if (!pendingRemoteDial) return;
    if (status !== "connected") return;
    if (hasActiveCall) return;
    if (!isDialPhoneValid(pendingRemoteDial.phoneNumber)) {
      toast.error(t("toasts.invalidPhone"));
      setPendingRemoteDial(null);
      return;
    }
    setActiveWhatsApp(
      pendingRemoteDial.whatsAppPhoneId
        ? { label: pendingRemoteDial.whatsAppPhoneLabel }
        : null,
    );
    startCall(pendingRemoteDial.phoneNumber, {
      sipTrunkId: pendingRemoteDial.sipTrunkId,
      whatsAppPhoneId: pendingRemoteDial.whatsAppPhoneId,
    });
    setPendingRemoteDial(null);
  }, [pendingRemoteDial, status, hasActiveCall, startCall, t]);

  useEffect(() => {
    if (!hasActiveCall) setActiveWhatsApp(null);
  }, [hasActiveCall]);

  const connectionLabel =
    status === "connected"
      ? t("connection.online")
      : status === "connecting"
        ? t("connection.connecting")
        : t("connection.offline");

  const callLabel = useMemo(() => {
    if (!callState) return t("status.ready");
    if (callState.status === "waiting_slot") return t("status.waitingSlot");
    if (callState.status === "ringing") return t("status.ringing");
    if (callState.status === "answered")
      return t("status.inCall", { duration: formatDuration(elapsedSeconds) });
    if (callState.status === "ended") {
      return callState.reason
        ? t("status.endedWithReason", { reason: callState.reason })
        : t("status.ended");
    }
    return t("status.ready");
  }, [callState, elapsedSeconds, t]);

  const handleDial = useCallback(() => {
    const target = sanitizeDialPhone(dialPhone);
    if (!target || !isDialPhoneValid(target)) {
      toast.error(t("toasts.invalidPhone"));
      return;
    }

    if (status !== "connected") {
      toast.error(t("toasts.offline"));
      return;
    }

    startCall(target, { sipTrunkId: selectedTrunkId ?? undefined });
  }, [dialPhone, startCall, status, t, selectedTrunkId]);

  const pushKey = useCallback((key: string) => {
    setDialPhone((prev) => sanitizeDialPhone(`${prev}${key}`));
  }, []);

  const backspace = useCallback(() => {
    setDialPhone((prev) => prev.slice(0, -1));
  }, []);

  const isConnected = status === "connected";

  if (!canUseDialer) {
    return null;
  }

  return (
    <div className="fixed right-0 top-1/2 -translate-y-1/2 z-50 flex items-center">
      {/* Expanded panel */}
      {open && (
        <Card
          style={{ width }}
          className={cn(
            "relative overflow-hidden border-border/80 bg-card/95 shadow-xl backdrop-blur-sm mr-0 rounded-r-none border-r-0",
            resizing && "select-none",
          )}
        >
          {/* Left-edge resize handle. The panel is right-docked, so dragging
              left widens it; the width persists in localStorage. */}
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label={t("resize")}
            title={t("resize")}
            onPointerDown={startResize}
            className="group absolute left-0 top-0 z-20 flex h-full w-2 cursor-ew-resize touch-none items-center justify-center"
          >
            <span
              className={cn(
                "h-10 w-1 rounded-full bg-border transition-colors duration-150 group-hover:bg-primary/50",
                resizing && "bg-primary",
              )}
            />
          </div>
          <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {t("title")}
              </p>
              <p className="text-xs text-muted-foreground">{callLabel}</p>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "border px-2 py-0.5 text-[11px]",
                isConnected
                  ? "border-emerald-500/40 text-emerald-600"
                  : status === "connecting"
                    ? "border-amber-500/40 text-amber-600"
                    : "border-rose-500/40 text-rose-600",
              )}
            >
              {connectionLabel}
            </Badge>
          </div>

          <div className="space-y-3 px-4 py-4">
            {activeWhatsApp ? (
              <WhatsAppChannelIndicator
                label={activeWhatsApp.label}
                caption={t("viaWhatsapp")}
              />
            ) : availableSipTrunks.length > 0 ? (
              <ElevatedCommandSelect
                value={selectedTrunkId}
                onValueChange={(value) => setSelectedTrunkId(value)}
                label={t("selectTrunkLabel")}
                options={availableSipTrunks.map((trunk) => ({
                  label: trunk.name,
                  value: trunk.id,
                }))}
              />
            ) : (
              <NoTrunkOverlay translator={t} />
            )}
            <div className="space-y-2">
              <Input
                value={dialPhone}
                onChange={(event) =>
                  setDialPhone(sanitizeDialPhone(event.target.value))
                }
                placeholder={t("placeholder")}
                inputMode="tel"
                autoComplete="off"
                aria-label={t("ariaLabel")}
                disabled={hasActiveCall}
                className="font-medium tracking-[0.06em]"
              />
              <div className="grid grid-cols-3 gap-2">
                {KEYPAD_KEYS.map((key) => (
                  <Button
                    key={key}
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => pushKey(key)}
                    disabled={hasActiveCall}
                    className="h-9 rounded-lg"
                  >
                    {key}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={backspace}
                disabled={hasActiveCall || dialPhone.length === 0}
                className="rounded-lg"
              >
                {t("actions.erase")}
              </Button>
              {hasActiveCall ? (
                <Button
                  type="button"
                  onClick={endCall}
                  className="rounded-lg bg-rose-600 text-white hover:bg-rose-700"
                >
                  <PhoneDisconnect weight="fill" className="h-4 w-4" />
                  {t("actions.hangup")}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleDial}
                  disabled={!isConnected || !canDial}
                  className="rounded-lg"
                >
                  <PhoneCall weight="fill" className="h-4 w-4" />
                  {t("actions.call")}
                </Button>
              )}
            </div>
            {/* Live team presence. Permission-gated on dialer:list_members
                (matches the backend push, which only sends the full roster to
                permitted users); everyone else does not see the roster. */}
            {canListDialerMembers && currentWorkspace?.id ? (
              <DialerPresencePanel
                presence={presence}
                members={members}
                selfUserId={selfUserId}
                connected={isConnected}
                membersLoaded={membersLoaded}
              />
            ) : null}
            {/* Member-to-member transfer controls. The TransferPanel
                manages its own picker/consult states. It mounts while the
                call is answered AND while an outgoing transfer is in flight:
                a blind (cega) transfer parks the customer and ends this
                agent's call view at initiate, but they must still be able to
                watch and cancel the pending offer. */}
            {(callState?.status === "answered" || outgoingTransfer) &&
            currentWorkspace?.id ? (
              <TransferPanel
                outgoingTransfer={outgoingTransfer}
                members={members}
                presence={presence}
                selfUserId={selfUserId}
                refreshTargets={refreshTransferTargets}
                initiate={initiateTransfer}
                completeAttended={completeAttended}
                cancelAttended={cancelAttended}
                enabled={isConnected}
                canTransfer={canTransferDialer}
                canListMembers={canListDialerMembers}
                queueEnabled={queueEnabled}
              />
            ) : null}
            {/* Incoming offer renders as a global modal below, it must
                stay visible even when this dialer panel is collapsed. */}
          </div>
        </Card>
      )}

      {/* Global ringing modal, portaled to <body>, so it shows even when
          the dialer is collapsed or the user is on another page. */}
      {incomingOffer ? (
        <IncomingTransferModal
          offer={incomingOffer}
          initiatorName={initiatorName}
          accept={acceptTransfer}
          decline={declineTransfer}
        />
      ) : null}

      {incomingCall ? (
        <IncomingCallModal
          offer={incomingCall}
          accept={acceptIncomingCall}
          decline={declineIncomingCall}
        />
      ) : null}

      {/* Vertical tab, always visible on right edge */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex flex-col items-center justify-center gap-2 px-1.5 py-4 rounded-l-xl border border-r-0 bg-card/95 shadow-lg backdrop-blur-sm transition-all",
          "border-border/80 hover:bg-muted",
          open && "border-l border-border/80",
        )}
      >
        <div
          className={cn(
            "h-2 w-2 rounded-full",
            isConnected
              ? "bg-emerald-500"
              : status === "connecting"
                ? "bg-amber-500"
                : "bg-rose-500",
          )}
        />
        <span
          className="text-[10px] font-semibold text-muted-foreground tracking-wide"
          style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
        >
          {t("title")}
        </span>
        <PhoneCall
          weight="fill"
          className="h-3.5 w-3.5 text-muted-foreground"
        />
      </button>
    </div>
  );
}
