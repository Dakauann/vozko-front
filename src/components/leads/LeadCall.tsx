"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { PhoneCall } from "@/components/icons";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useMayPlaceCalls } from "@/hooks/use-call-readiness";
import { useDialBlockerReason } from "@/hooks/use-dial-blocker-reason";
import { useDialTargets } from "@/hooks/use-dial-targets";
import type { DialBlocker } from "@/lib/dialer/dial-targets";
import { formatPhoneForDisplay } from "@/lib/phone/display";
import { cn } from "@/lib/utils";

interface CallControlProps {
  blocker: DialBlocker | null;
  onCall: () => void;
  label?: string;
  ariaLabel?: string;
  compact?: boolean;
  className?: string;
}

function CallControl({ blocker, onCall, label, ariaLabel, compact = false, className }: CallControlProps) {
  const reasonId = useId();
  const reason = useDialBlockerReason(blocker);
  const blocked = blocker !== null;
  return (
    <span className={cn("inline-flex", className)}>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Button
                variant={compact ? "ghost" : "secondary"}
                size={compact ? "icon" : "sm"}
                icon={<PhoneCall className={compact ? "h-4 w-4" : "h-3.5 w-3.5"} weight="bold" />}
                iconVisible
                iconSide="left"
                title={label}
                aria-label={ariaLabel}
                aria-disabled={blocked || undefined}
                aria-describedby={reason ? reasonId : undefined}
                onClick={() => {
                  if (!blocked) onCall();
                }}
              />
            </span>
          </TooltipTrigger>
          {reason ? (
            <TooltipContent side="top">
              <p>{reason}</p>
            </TooltipContent>
          ) : null}
        </Tooltip>
      </TooltipProvider>
      {reason ? (
        <span id={reasonId} className="sr-only">
          {reason}
        </span>
      ) : null}
    </span>
  );
}

export interface LeadCallProps {
  leadId: string;
  revision?: number;
  className?: string;
}

function LeadCallButtonView({ leadId, revision, className }: LeadCallProps) {
  const t = useTranslations("calling.dialTargets");
  const dial = useDialTargets({ leadId, revision });
  return <CallControl blocker={dial.blocker} onCall={() => dial.call()} label={t("call")} className={className} />;
}

export function LeadCallButton(props: LeadCallProps) {
  const permitted = useMayPlaceCalls();
  if (!permitted) return null;
  return <LeadCallButtonView {...props} />;
}

export interface LeadNumberCallProps {
  leadId: string;
  revision?: number;
  identity?: boolean;
  phoneId?: string;
  className?: string;
}

function LeadNumberCallView({ leadId, revision, identity = false, phoneId, className }: LeadNumberCallProps) {
  const t = useTranslations("calling.dialTargets");
  const dial = useDialTargets({ leadId, revision });
  const held = dial.targets?.numbers.find((entry) => (identity ? entry.identity : phoneId !== undefined && entry.phoneId === phoneId));
  if (!held) return null;
  return (
    <CallControl
      blocker={dial.numberBlocker(held.number)}
      onCall={() => dial.callNumber(held.number)}
      ariaLabel={t("callNumber", { number: formatPhoneForDisplay(held.number) })}
      compact
      className={className}
    />
  );
}

export function LeadNumberCall(props: LeadNumberCallProps) {
  const permitted = useMayPlaceCalls();
  if (!permitted) return null;
  return <LeadNumberCallView {...props} />;
}

export function LeadCallMenuItem({ leadId, revision }: { leadId: string; revision?: number }) {
  const t = useTranslations("calling.dialTargets");
  const reasonId = useId();
  const dial = useDialTargets({ leadId, revision });
  const reason = useDialBlockerReason(dial.blocker);
  return (
    <>
      <DropdownMenuItem
        disabled={dial.blocker !== null}
        aria-describedby={reason ? reasonId : undefined}
        onSelect={() => dial.call()}
      >
        <PhoneCall className="h-4 w-4" aria-hidden />
        {t("call")}
      </DropdownMenuItem>
      {reason ? (
        <p id={reasonId} className="pb-1.5 pl-[2.375rem] pr-2.5 text-2xs text-muted-foreground">
          {reason}
        </p>
      ) : null}
    </>
  );
}
