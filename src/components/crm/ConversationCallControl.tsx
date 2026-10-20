"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { PhoneCall, WhatsappLogo } from "@/components/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import TooltipWrapper from "@/components/ui/tooltip-wrapper";
import {
  getCallPermissionStatusAction,
  requestCallPermissionAction,
  type CallPermissionStatus,
} from "@/app/actions/conversations";
import { listBusinessPhonesAction } from "@/app/actions/whatsapp-business-phones";
import { useWorkspace } from "@/contexts/workspace-context";
import { requestCall, useCallActive } from "@/lib/call-session/call-session-control";
import {
  channelCapabilities,
  normalizeEntryType,
  type ConversationMessage,
  type EntryType,
  type InboxEntry,
} from "@/lib/conversations/types";
import type { WhatsAppBusinessPhone } from "@/lib/whatsapp-business-phones/types";
import { cn } from "@/lib/utils";

interface ConversationCallControlProps {
  entryId: string;
  entryType: EntryType;
  leadNumber: string;
  messages: ConversationMessage[];
  inbox: InboxEntry[];
  translations: {
    startCall?: string;
    callViaWhatsapp?: string;
    callFailed?: string;
  };
}

const NO_PERMISSION: CallPermissionStatus = { status: "none", can_call: false };

const MENU_ITEM =
  "flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors";

function lastPermissionSignal(messages: ConversationMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const type = messages[i].message_type;
    if (type === "call_permission_granted" || type === "call_permission_rejected") {
      return messages[i].id;
    }
  }
  return "";
}

export default function ConversationCallControl({
  entryId,
  entryType,
  leadNumber,
  messages,
  inbox,
  translations,
}: ConversationCallControlProps) {
  const t = useTranslations("crmConversationHeader.call");
  const tCommon = useTranslations("common");
  const { can, currentWorkspace } = useWorkspace();
  const isCallBusy = useCallActive();
  const [open, setOpen] = useState(false);
  const [requestingPermission, setRequestingPermission] = useState(false);
  const whatsappLabel = translations.callViaWhatsapp ?? "WhatsApp";

  const allowed = can("call_session", "use") && channelCapabilities.supportsCalling(entryType);
  const isWhatsApp = normalizeEntryType(entryType) === "whatsapp";
  const permissionSignal = useMemo(() => lastPermissionSignal(messages), [messages]);

  const { data: whatsappPhones = [], isLoading: loadingPhones } = useQuery<WhatsAppBusinessPhone[]>({
    queryKey: ["crm-call-phones", currentWorkspace?.id],
    enabled: allowed && open && !!currentWorkspace?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const result = await listBusinessPhonesAction({ status: "CONNECTED", pageSize: 500 });
      if (result.error) throw new Error(result.error);
      return result.phones;
    },
  });

  const { data: permission = NO_PERMISSION, isLoading: loadingPermission } = useQuery<CallPermissionStatus>({
    queryKey: ["crm-call-permission", entryType, entryId, permissionSignal],
    enabled: allowed && isWhatsApp,
    queryFn: async () => (await getCallPermissionStatusAction("whatsapp", entryId)).status ?? NO_PERMISSION,
  });

  const placeCall = useCallback(
    (whatsAppPhoneId: string, label?: string) => {
      setOpen(false);
      if (!leadNumber) {
        toast.error(translations.callFailed ?? t("noLeadNumber"));
        return;
      }
      if (!whatsAppPhoneId) {
        toast.error(t("noBusinessPhone"));
        return;
      }
      requestCall({ phoneNumber: leadNumber, whatsAppPhoneId, label });
    },
    [leadNumber, t, translations.callFailed],
  );

  const askPermission = useCallback(async () => {
    setOpen(false);
    if (requestingPermission) return;
    setRequestingPermission(true);
    try {
      const result = await requestCallPermissionAction(normalizeEntryType(entryType), entryId);
      if (result.error) toast.error(result.error);
      else toast.success(t("permissionRequested"));
    } finally {
      setRequestingPermission(false);
    }
  }, [entryId, entryType, requestingPermission, t]);

  if (!allowed) return null;

  const openEntry = inbox.find((e) => e.entry_id === entryId);
  const openEntryIsWhatsApp = !!openEntry && normalizeEntryType(openEntry.entry_type) === "whatsapp";
  const sameLeadWhatsApp = leadNumber
    ? inbox.find(
        (e) =>
          e.lead_number === leadNumber &&
          normalizeEntryType(e.entry_type) === "whatsapp" &&
          !!e.business_phone_id,
      )
    : undefined;
  const resolvedPhoneId =
    (openEntryIsWhatsApp ? openEntry?.business_phone_id : "") ||
    sameLeadWhatsApp?.business_phone_id ||
    (whatsappPhones.length === 1 ? whatsappPhones[0].id : "");
  const resolvedPhone = whatsappPhones.find((p) => p.id === resolvedPhoneId);

  function phoneChoices() {
    if (loadingPhones) {
      return <div role="status" className="px-3 py-2 text-xs text-muted-foreground">{tCommon("loading")}</div>;
    }
    if (resolvedPhoneId) {
      if (loadingPermission || !permission.can_call) {
        return (
          <button
            type="button"
            disabled
            title={loadingPermission ? undefined : t("permissionTitle")}
            className={cn(MENU_ITEM, "text-muted-foreground cursor-not-allowed")}
          >
            <WhatsappLogo weight="bold" className="h-3.5 w-3.5" />
            <span className="truncate">{whatsappLabel}</span>
            <span className="ml-auto text-2xs font-semibold text-muted-foreground">
              {loadingPermission ? t("checking") : t("permissionNeeded")}
            </span>
          </button>
        );
      }
      return (
        <button
          type="button"
          onClick={() =>
            placeCall(resolvedPhoneId, resolvedPhone?.verifiedName || resolvedPhone?.displayPhoneNumber)
          }
          className={cn(MENU_ITEM, "text-foreground hover:bg-muted")}
        >
          <WhatsappLogo weight="bold" className="h-3.5 w-3.5 text-healthy-ink" />
          <span className="truncate">{whatsappLabel}</span>
          {resolvedPhone && (
            <span className="ml-auto text-2xs text-muted-foreground truncate">
              {resolvedPhone.displayPhoneNumber}
            </span>
          )}
        </button>
      );
    }
    if (whatsappPhones.length === 0) {
      return (
        <button type="button" disabled className={cn(MENU_ITEM, "text-muted-foreground cursor-not-allowed")}>
          <WhatsappLogo weight="bold" className="h-3.5 w-3.5" />
          <span>{whatsappLabel}</span>
          <span className="ml-auto text-2xs font-semibold text-muted-foreground">{t("unavailable")}</span>
        </button>
      );
    }
    return (
      <>
        <div className="px-3 py-1.5 text-2xs font-semibold text-muted-foreground">{whatsappLabel}</div>
        {whatsappPhones.map((phone) => (
          <button
            key={phone.id}
            type="button"
            onClick={() => placeCall(phone.id, phone.verifiedName || phone.displayPhoneNumber)}
            className={cn(MENU_ITEM, "text-foreground hover:bg-muted")}
          >
            <WhatsappLogo weight="bold" className="h-3.5 w-3.5 text-healthy-ink" />
            <span className="truncate">{phone.verifiedName || phone.displayPhoneNumber}</span>
            {phone.verifiedName && (
              <span className="ml-auto text-2xs text-muted-foreground truncate">{phone.displayPhoneNumber}</span>
            )}
          </button>
        ))}
      </>
    );
  }

  const startCallLabel = translations.startCall ?? t("start");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <TooltipWrapper content={startCallLabel}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={isCallBusy}
            aria-label={startCallLabel}
            className={cn(
              "flex items-center justify-center h-8 w-8 rounded-full transition-colors",
              isCallBusy
                ? "bg-healthy text-healthy-foreground cursor-not-allowed"
                : "bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground",
            )}
          >
            <PhoneCall weight={isCallBusy ? "fill" : "regular"} className="h-4 w-4" />
          </button>
        </PopoverTrigger>
      </TooltipWrapper>
      <PopoverContent align="end" className="w-56 p-0 py-1">
        {phoneChoices()}
        {can("conversations", "call") && (
          <>
            <div className="my-1 border-t border-border" />
            <button
              type="button"
              onClick={askPermission}
              disabled={requestingPermission}
              className={cn(
                MENU_ITEM,
                requestingPermission ? "text-muted-foreground cursor-not-allowed" : "text-foreground hover:bg-muted",
              )}
            >
              <WhatsappLogo weight="bold" className="h-3.5 w-3.5 text-warning-ink" />
              <span>{requestingPermission ? t("requesting") : t("requestPermission")}</span>
            </button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
