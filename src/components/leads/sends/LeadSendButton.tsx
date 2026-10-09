"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { ChatText, PaperPlaneTilt } from "@/components/icons";
import { GuardedAction } from "@/components/selection/GuardedAction";
import type { LeadSendAction, LeadSendBlocker } from "@/lib/leads/sends";

import { LeadSendDialog } from "./LeadSendDialog";
import { useLeadSendGate } from "./use-lead-send-gate";

const HIDDEN_WHEN: readonly LeadSendBlocker[] = ["permissionSendTemplate", "permissionSendUnofficial"];

export function LeadSendButton({ leadId, action, label }: { leadId: string; action: LeadSendAction; label: string }) {
  const tBlockers = useTranslations("leadSends.blockers");
  const states = useLeadSendGate();
  const state = action === "send_template" ? states.send_template : states.send_message;
  const [open, setOpen] = useState(false);
  const reasonId = useId();

  if (!state.enabled && HIDDEN_WHEN.includes(state.reason)) return null;
  const reason = state.enabled ? null : tBlockers(state.reason);
  const Icon = action === "send_template" ? PaperPlaneTilt : ChatText;

  return (
    <>
      <GuardedAction reason={reason}>
        <span className="inline-flex">
          <Button
            variant="secondary"
            size="sm"
            icon={<Icon className="h-3.5 w-3.5" />}
            iconVisible
            iconSide="left"
            title={label}
            disabled={!state.enabled}
            aria-describedby={reason ? reasonId : undefined}
            onClick={() => setOpen(true)}
          />
        </span>
      </GuardedAction>
      {reason ? (
        <span id={reasonId} className="sr-only">
          {reason}
        </span>
      ) : null}
      {open ? <LeadSendDialog action={action} selection={{ mode: "ids", ids: [leadId] }} size={1} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
