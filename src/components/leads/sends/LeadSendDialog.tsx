"use client";

import type { LeadSendAction } from "@/lib/leads/sends";

import type { LeadSendDialogProps } from "./LeadSendDialogFrame";
import { LeadMessageSendDialog } from "./LeadMessageSendDialog";
import { LeadTemplateSendDialog } from "./LeadTemplateSendDialog";

export function LeadSendDialog({ action, ...props }: LeadSendDialogProps & { action: LeadSendAction }) {
  return action === "send_template" ? <LeadTemplateSendDialog {...props} /> : <LeadMessageSendDialog {...props} />;
}
